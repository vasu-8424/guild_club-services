import { NextRequest, NextResponse } from "next/server";
import { getScope } from "@/lib/scope";
import { db } from "@/db";
import { cases, clients, sessions, branches } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { recordEvent } from "@/lib/events";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const dynamic = "force-dynamic";

interface PatientReportRow {
  patientId: string;
  patientName: string;
  age: number | string;
  sex: string;
  service: string;
  room: string;
  startDate: string;
  status: "active" | "closed";
  presentCondition: string;
  improvementSummary: string;
}

export async function GET(req: NextRequest) {
  try {
    const scope = await getScope();

    // 1. Role enforcement: Only admin and super_admin
    if (!scope.isAdmin && !scope.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();
    const requestedBranchId = searchParams.get("branchId") || scope.activeBranchId;

    if (!requestedBranchId) {
      return NextResponse.json(
        { error: "No branch selected. Please choose a branch to generate the report." },
        { status: 404 }
      );
    }

    // 2. Branch scoping check
    if (!scope.canAccessBranch(requestedBranchId)) {
      return NextResponse.json(
        { error: "Access to the requested branch is not authorized" },
        { status: 404 }
      );
    }

    // Fetch branch info
    const [branchRow] = await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.id, requestedBranchId))
      .limit(1);

    if (!branchRow) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // 3. Paginate database query: 1,000 rows per batch
    const allRows: PatientReportRow[] = [];
    const BATCH_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await db
        .select({
          id: cases.id,
          patientId: cases.patientId,
          service: cases.service,
          roomNo: cases.roomNo,
          startDate: cases.startDate,
          status: cases.status,
          outcome: cases.outcome,
          presentCondition: cases.presentCondition,
          presentConditionAtClose: cases.presentConditionAtClose,
          clientName: clients.fullName,
          clientAge: clients.age,
          clientGender: clients.gender,
        })
        .from(cases)
        .innerJoin(clients, eq(cases.clientId, clients.id))
        .where(eq(cases.branchId, requestedBranchId))
        .orderBy(sql`${cases.createdAt} DESC`)
        .limit(BATCH_SIZE)
        .offset(offset);

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      // Collect case IDs to query session counts in batch
      const caseIds = batch.map((b) => b.id);
      const sessionCounts = await db
        .select({
          caseId: sessions.caseId,
          heldCount: sql<number>`count(case when ${sessions.status} = 'held' then 1 end)::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(sessions)
        .where(inArray(sessions.caseId, caseIds))
        .groupBy(sessions.caseId);

      const sessionMap = new Map<string, { held: number; total: number }>();
      for (const sc of sessionCounts) {
        sessionMap.set(sc.caseId, { held: sc.heldCount, total: sc.totalCount });
      }

      for (const row of batch) {
        const counts = sessionMap.get(row.id) || { held: 0, total: 0 };
        const isClosed = row.status === "completed";
        const statusLabel: "active" | "closed" = isClosed ? "closed" : "active";

        const condition = isClosed
          ? row.presentConditionAtClose || row.presentCondition || "N/A"
          : row.presentCondition || "N/A";

        // Improvement summary: Outcome label + session counts
        let outcomeLabel = "In progress";
        if (row.outcome) {
          outcomeLabel = row.outcome.replace(/_/g, " ");
          outcomeLabel = outcomeLabel.charAt(0).toUpperCase() + outcomeLabel.slice(1);
        } else if (isClosed) {
          outcomeLabel = "Completed";
        } else if (counts.held > 0) {
          outcomeLabel = "Active";
        }

        const improvementSummary = `${outcomeLabel}, ${counts.held} of ${counts.total || counts.held} sessions`;

        allRows.push({
          patientId: row.patientId || "N/A",
          patientName: row.clientName,
          age: row.clientAge ?? "N/A",
          sex: row.clientGender ?? "N/A",
          service: row.service ? row.service.replace(/_/g, " ") : "N/A",
          room: row.roomNo || "N/A",
          startDate: row.startDate ? String(row.startDate) : "N/A",
          status: statusLabel,
          presentCondition: condition,
          improvementSummary,
        });
      }

      offset += batch.length;
      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    // 4. Log audit event: report_downloaded (NO personal patient data logged)
    await recordEvent(db, {
      eventType: "report_downloaded",
      actorId: scope.user.id,
      actorRole: scope.user.role,
      metadata: {
        format,
        rowCount: allRows.length,
        branchId: requestedBranchId,
      },
    });

    const dateStr = new Date().toISOString().split("T")[0];
    const safeBranchName = branchRow.name.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();

    // 5. Output format handling: CSV
    if (format === "csv") {
      const headers = [
        "Patient ID",
        "Patient Name",
        "Age",
        "Sex",
        "Service",
        "Room",
        "Start Date",
        "Status",
        "Present Condition",
        "Improvement Summary",
      ];

      const escapeCsvCell = (val: string | number) => {
        const str = String(val ?? "").replace(/"/g, '""');
        return `"${str}"`;
      };

      const csvLines = [
        headers.join(","),
        ...allRows.map((r) =>
          [
            escapeCsvCell(r.patientId),
            escapeCsvCell(r.patientName),
            escapeCsvCell(r.age),
            escapeCsvCell(r.sex),
            escapeCsvCell(r.service),
            escapeCsvCell(r.room),
            escapeCsvCell(r.startDate),
            escapeCsvCell(r.status),
            escapeCsvCell(r.presentCondition),
            escapeCsvCell(r.improvementSummary),
          ].join(",")
        ),
      ];

      // Prepend UTF-8 BOM so Excel opens with proper encoding
      const csvContent = "\uFEFF" + csvLines.join("\r\n");

      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="patient-report-${safeBranchName}-${dateStr}.csv"`,
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      });
    }

    // 6. Output format handling: PDF (A4 Landscape, no row splitting)
    if (format === "pdf") {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Header Banner
      doc.setFontSize(16);
      doc.setTextColor(11, 122, 99); // #0B7A63
      doc.text("GUILD CLUB SERVICES", 14, 15);

      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text(`Branch Patient Roster: ${branchRow.name}`, 14, 22);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated: ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} | Total Records: ${allRows.length} | Confidential Clinical Document`,
        14,
        28
      );

      const tableData = allRows.map((r) => [
        r.patientId,
        r.patientName,
        `${r.age} / ${r.sex}`,
        r.service,
        r.room,
        r.startDate,
        r.status.toUpperCase(),
        r.presentCondition,
        r.improvementSummary,
      ]);

      autoTable(doc, {
        head: [
          [
            "Patient ID",
            "Patient Name",
            "Age/Sex",
            "Service",
            "Room",
            "Start Date",
            "Status",
            "Present Condition",
            "Improvement Summary",
          ],
        ],
        body: tableData,
        startY: 32,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [11, 122, 99], // #0B7A63
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        pageBreak: "auto",
        rowPageBreak: "avoid", // Prevents splitting a single patient row across pages
        margin: { top: 15, left: 14, right: 14, bottom: 15 },
      });

      const pdfArrayBuffer = doc.output("arraybuffer");

      return new Response(pdfArrayBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="patient-report-${safeBranchName}-${dateStr}.pdf"`,
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format. Use 'csv' or 'pdf'." }, { status: 400 });
  } catch (err: any) {
    console.error("Branch report error:", err);
    return NextResponse.json(
      { error: "Failed to generate report. Please try again." },
      { status: 500 }
    );
  }
}

