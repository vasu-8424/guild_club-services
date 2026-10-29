"use server";

import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cases,
  clients,
  casePhotos,
  branches,
  rooms,
  ServiceType,
  serviceTypeEnum,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { generateCaseNumber } from "@/lib/case-number";
import { recordEvent } from "@/lib/events";
import { notifyCaseCreated } from "@/lib/notifications/in-app";
import { saveStorageFile } from "@/lib/storage";
import { getDaysAgoIST, getDaysAheadIST, getTodayIST } from "@/lib/date-utils";
import { and, eq, ne } from "drizzle-orm";
import { getScope, ScopeError } from "@/lib/scope";

export interface CreateCasePhotoInput {
  base64Data: string; // data:image/jpeg;base64,... or raw base64
  filename: string;
  contentType: string; // image/jpeg | image/png | image/webp
}

export interface CreateCaseInput {
  patientName: string;
  age: number;
  sex: "male" | "female" | "other";
  problem: string;
  presentCondition: string;
  service: ServiceType;
  startDate: string; // YYYY-MM-DD
  roomId: string;
  roomNo?: string;
  branchId: string;
  consentObtained: boolean;
  photos: CreateCasePhotoInput[];
}

export interface CreateCaseResult {
  success: boolean;
  caseId?: string;
  patientId?: string;
  caseNumber?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  status?: number;
}

const createCaseSchema = z.object({
  patientName: z.string().trim().min(2, "Patient name must be at least 2 characters."),
  age: z.coerce.number().int().min(0, "Age must be at least 0.").max(120, "Age cannot exceed 120."),
  sex: z.enum(["male", "female", "other"] as const, {
    message: "Select a valid sex option.",
  }),
  problem: z.string().trim().min(2, "Problem description is required."),
  presentCondition: z.string().trim().min(2, "Present condition is required."),
  service: z.enum(serviceTypeEnum.enumValues, {
    message: "Select a valid clinical service.",
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)."),
  roomId: z.string().uuid("Please select a room."),
  branchId: z.string().uuid("Please select a valid branch."),
  consentObtained: z.literal(true, {
    message: "Patient or guardian consent is mandatory.",
  }),
});

export async function createCaseTherapistAction(
  data: CreateCaseInput
): Promise<CreateCaseResult> {
  // 1. Role validation: Therapists only
  const currentUser = await getCurrentUser();
  if (!currentUser || !currentUser.isActive) {
    return { success: false, error: "Unauthorized", status: 401 };
  }

  if (currentUser.role !== "therapist") {
    return {
      success: false,
      error: "Forbidden: Only therapists are authorized to create cases.",
      status: 403,
    };
  }

  // 2. Zod validation
  const parsed = createCaseSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((err) => {
      const field = String(err.path[0] || "form");
      fieldErrors[field] = err.message;
    });
    return {
      success: false,
      error: "Please correct the errors in the form.",
      fieldErrors,
      status: 400,
    };
  }

  const {
    patientName,
    age,
    sex,
    problem,
    presentCondition,
    service,
    startDate,
    roomId,
    branchId,
  } = parsed.data;

  // 3. Verify therapist branch assignment
  try {
    const scope = await getScope(currentUser, branchId);
    scope.assertBranchAccess(branchId);
  } catch (err: any) {
    return {
      success: false,
      error: "Forbidden: You are not assigned to this branch.",
      status: 403,
    };
  }

  // 4. Date boundary validation: past 30 days to future 30 days IST
  const minDate = getDaysAgoIST(30);
  const maxDate = getDaysAheadIST(30);
  if (startDate < minDate || startDate > maxDate) {
    return {
      success: false,
      error: `Start date must be between ${minDate} and ${maxDate}.`,
      fieldErrors: {
        startDate: `Start date must be within 30 days in the past or 30 days ahead.`,
      },
      status: 400,
    };
  }

  // 4. Validate photos
  const rawPhotos = data.photos || [];
  if (rawPhotos.length === 0) {
    return {
      success: false,
      error: "At least one joining condition photo is required.",
      fieldErrors: { photos: "Joining condition photo is required." },
      status: 400,
    };
  }
  if (rawPhotos.length > 3) {
    return {
      success: false,
      error: "A maximum of 3 joining condition photos can be uploaded.",
      fieldErrors: { photos: "Maximum 3 photos allowed." },
      status: 400,
    };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  for (const p of rawPhotos) {
    const normalizedType = p.contentType?.toLowerCase();
    if (!allowedTypes.includes(normalizedType)) {
      return {
        success: false,
        error: "Only JPEG, PNG, and WebP images are allowed.",
        fieldErrors: { photos: "Invalid image format. Only JPEG, PNG, and WebP are allowed." },
        status: 400,
      };
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 5. Verify room availability inside transaction
      const [room] = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);

      if (!room || !room.isActive || room.branchId !== branchId) {
        throw new Error("No free rooms in this branch. Ask your admin to add a room.");
      }

      const [occupiedOnRoom] = await tx
        .select({ id: cases.id })
        .from(cases)
        .where(and(eq(cases.roomId, roomId), ne(cases.status, "completed")))
        .limit(1);

      if (occupiedOnRoom) {
        throw new Error("This room was just taken by another patient. Please choose another room.");
      }

      // 6. Generate Patient ID: GCP-0001
      const seqRes = await tx.execute<{ seq: string }>(
        sql`SELECT nextval('patient_id_seq')::text as seq;`
      );
      const seqVal = seqRes.rows?.[0]?.seq ? parseInt(seqRes.rows[0].seq, 10) : 1;
      const patientId = `GCP-${String(seqVal).padStart(4, "0")}`;

      // 7. Generate Case Number: GCS-YYYY-NNNN
      const caseNumber = await generateCaseNumber(tx as any);

      // 8. Create Client
      const [client] = await tx
        .insert(clients)
        .values({
          fullName: patientName,
          age,
          gender: sex,
          phone: "Not provided",
          email: null,
        })
        .returning({ id: clients.id });

      // 9. Create Case with status = 'active', roomId and roomNo
      const [newCase] = await tx
        .insert(cases)
        .values({
          caseNumber,
          patientId,
          clientId: client.id,
          category: service,
          priority: "medium",
          description: problem,
          status: "active",
          createdBy: currentUser.id,
          currentTherapistId: currentUser.id,
          service,
          problem,
          presentCondition,
          startDate,
          roomId: room.id,
          roomNo: room.roomNo,
          branchId: room.branchId,
          sex,
          consentObtained: true,
        })
        .returning({ id: cases.id });

      // 10. Save photos and insert into casePhotos
      for (let i = 0; i < rawPhotos.length; i++) {
        const photo = rawPhotos[i];
        let base64Content = photo.base64Data;
        if (base64Content.includes(",")) {
          base64Content = base64Content.split(",")[1];
        }
        const buffer = Buffer.from(base64Content, "base64");

        // Validate max 5MB
        if (buffer.length > 5 * 1024 * 1024) {
          throw new Error("Each photo must be smaller than 5 MB.");
        }

        const ext = photo.contentType === "image/png" ? "png" : photo.contentType === "image/webp" ? "webp" : "jpg";
        const filename = `joining_${newCase.id}_${i + 1}_${Date.now()}.${ext}`;
        const fileKey = await saveStorageFile(filename, buffer, photo.contentType);

        await tx.insert(casePhotos).values({
          caseId: newCase.id,
          kind: "joining",
          fileKey,
          uploadedBy: currentUser.id,
        });
      }

      // 11. Record audit events
      await recordEvent(tx, {
        eventType: "case_created",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId: newCase.id,
        toStatus: "active",
        metadata: {
          patientId,
          caseNumber,
          service,
          startDate,
          branchId: room.branchId,
          roomId: room.id,
          roomNo: room.roomNo,
        },
      });

      await recordEvent(tx, {
        eventType: "joining_photo_added",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId: newCase.id,
        metadata: {
          photoCount: rawPhotos.length,
        },
      });

      // 12. Notify Admins and Super Admins in-app (no email)
      await notifyCaseCreated({
        tx,
        caseId: newCase.id,
        patientId,
        caseNumber,
        therapistName: currentUser.name,
        branchId: room.branchId,
      });

      return {
        caseId: newCase.id,
        patientId,
        caseNumber,
      };
    });

    return {
      success: true,
      caseId: result.caseId,
      patientId: result.patientId,
      caseNumber: result.caseNumber,
    };
  } catch (error: any) {
    console.error("Failed to create case:", error);
    if (
      error?.code === "23505" ||
      error?.message?.includes("one_open_case_per_room") ||
      error?.message?.includes("This room was just taken by another patient")
    ) {
      return {
        success: false,
        error: "This room was just taken by another patient. Please choose another room.",
        fieldErrors: {
          roomId: "This room was just taken by another patient. Please choose another room.",
        },
        status: 409,
      };
    }
    return {
      success: false,
      error: error?.message || "Failed to create case. Please try again.",
      status: 500,
    };
  }
}
