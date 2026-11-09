"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CLINICAL_SERVICES } from "@/lib/services";
import { type Branch, type ServiceType } from "@/db/schema";
import {
  createCaseTherapistAction,
  type CreateCasePhotoInput,
} from "@/lib/actions/case-creation-actions";
import { getFreeRoomsForBranchAction } from "@/lib/actions/room-management-actions";
import { getTodayIST, getDaysAgoIST, getDaysAheadIST } from "@/lib/date-utils";
import { useKeyboardOffset, scrollInputIntoViewOnFocus } from "@/lib/mobile-keyboard";
import { useNetworkStatus } from "@/components/network/network-provider";
import {
  Upload,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

interface CreateCaseFormProps {
  branches: Branch[];
}

export function CreateCaseForm({ branches }: CreateCaseFormProps) {
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const keyboardOffset = useKeyboardOffset();

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<"male" | "female" | "other">("male");
  const [problem, setProblem] = useState("");
  const [presentCondition, setPresentCondition] = useState("");
  const [service, setService] = useState<ServiceType>("speech_therapy");
  const [startDate, setStartDate] = useState(getTodayIST());
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [roomId, setRoomId] = useState("");
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ id: string; roomNo: string }>
  >([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [consentObtained, setConsentObtained] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const fetchRooms = useCallback(async (bId: string) => {
    if (!bId) {
      setAvailableRooms([]);
      setRoomId("");
      return;
    }
    setLoadingRooms(true);
    try {
      const res = await getFreeRoomsForBranchAction(bId);
      if (res.success && res.rooms) {
        setAvailableRooms(res.rooms);
        setRoomId((prev) => {
          if (res.rooms && res.rooms.some((r) => r.id === prev)) return prev;
          return res.rooms && res.rooms[0] ? res.rooms[0].id : "";
        });
      }
    } catch {
      // silent
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (branchId) {
      fetchRooms(branchId);
      const interval = setInterval(() => fetchRooms(branchId), 20000);
      return () => clearInterval(interval);
    }
  }, [branchId, fetchRooms]);

  // Photos State: array of { base64Data, filename, contentType, previewUrl }
  const [photos, setPhotos] = useState<
    Array<{
      base64Data: string;
      filename: string;
      contentType: string;
      previewUrl: string;
    }>
  >([]);

  // Submission State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdResult, setCreatedResult] = useState<{
    caseId: string;
    patientId: string;
    caseNumber: string;
  } | null>(null);

  // Warn before discarding unsaved changes
  const isDirty = Boolean(patientName || problem || presentCondition || photos.length > 0);
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !createdResult) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, createdResult]);

  // Client-side image compression: max 1600px width/height
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 3) {
      setError("You can upload a maximum of 3 joining condition photos.");
      return;
    }

    setIsCompressing(true);
    Array.from(files).forEach((file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Only JPEG, PNG, and WebP images are allowed.");
        setIsCompressing(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1600;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL(file.type, 0.85);

            setPhotos((prev) => {
              if (prev.length >= 3) return prev;
              return [
                ...prev,
                {
                  base64Data: compressedDataUrl,
                  filename: file.name,
                  contentType: file.type,
                  previewUrl: compressedDataUrl,
                },
              ];
            });
            setError(null);
            setIsCompressing(false);
          }
        };
        img.src = loadEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validations
    const errors: Record<string, string> = {};
    if (!patientName.trim()) {
      errors.patientName = "Patient name is required.";
    }
    if (age === "" || age < 0 || age > 120) {
      errors.age = "Valid age (0–120) is required.";
    }
    if (!problem.trim()) {
      errors.problem = "Clinical problem is required.";
    }
    if (!presentCondition.trim()) {
      errors.presentCondition = "Present condition is required.";
    }
    if (!branchId) {
      errors.branchId = "Branch selection is required.";
    }
    if (!roomId) {
      errors.roomId = "Room assignment is required.";
    }
    if (!startDate) {
      errors.startDate = "Start date is required.";
    }
    if (photos.length === 0) {
      setError("At least one joining condition photo is required.");
      errors.photos = "Joining condition photo is required.";
    }
    if (!consentObtained) {
      errors.consentObtained = "Explicit informed consent is required to proceed.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (!error) setError("Please fix the errors below before submitting.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        patientName: patientName.trim(),
        age: Number(age),
        sex,
        problem: problem.trim(),
        presentCondition: presentCondition.trim(),
        service,
        branchId,
        roomId,
        startDate,
        consentObtained: true,
        photos: photos.map((p) => ({
          base64Data: p.base64Data,
          filename: p.filename,
          contentType: p.contentType,
        })),
      };

      const result = await createCaseTherapistAction(payload);

      if (!result.success || !result.caseId) {
        setError(result.error || "Failed to create case.");
        setLoading(false);
        return;
      }

      setCreatedResult({
        caseId: result.caseId,
        patientId: result.patientId || "",
        caseNumber: result.caseNumber || "",
      });
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Render Success Screen upon Creation
  if (createdResult) {
    return (
      <div
        data-testid="case-created-banner"
        className="max-w-xl mx-auto bg-white border border-stone-200 p-6 sm:p-8 text-center space-y-6 shadow-xs rounded-none"
      >
        <div className="w-16 h-16 bg-emerald-50 text-[#0B7A63] border border-emerald-200 rounded-none flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold uppercase tracking-tight text-stone-900">
            Case Created Successfully
          </h2>
          <p className="text-sm text-stone-600">
            Patient record registered and 10 treatment calendar days initialized.
          </p>
        </div>

        <div className="p-4 bg-stone-50 border border-stone-200 space-y-2">
          <div>
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
              Patient ID
            </span>
            <span
              data-testid="created-patient-id"
              className="text-3xl font-mono font-bold text-[#0B7A63]"
            >
              {createdResult.patientId}
            </span>
          </div>
          <div>
            <span className="text-xs text-stone-400 block font-mono">
              Case Ref: {createdResult.caseNumber}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 justify-center">
          <button
            type="button"
            data-testid="go-to-case-btn"
            onClick={() => router.push(`/therapist/cases/${createdResult.caseId}`)}
            className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 bg-[#0B7A63] hover:bg-[#096350] text-white px-6 text-base font-semibold uppercase tracking-wider rounded-none transition-colors select-none touch-manipulation"
          >
            <span>Open Case & Calendar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/therapist/dashboard")}
            className="w-full min-h-[48px] border border-stone-300 hover:bg-stone-100 text-stone-700 px-6 text-[14px] font-semibold uppercase tracking-wider rounded-none transition-colors select-none touch-manipulation"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const minDate = getDaysAgoIST(30);
  const maxDate = getDaysAheadIST(30);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 w-full max-w-xl mx-auto bg-white border border-stone-200 p-4 sm:p-6 shadow-xs rounded-none pb-24"
    >
      <div className="border-b border-stone-200 pb-3">
        <h1 className="text-[24px] font-semibold tracking-tight text-stone-900 leading-tight">
          Create Case
        </h1>
        <p className="text-[13px] text-stone-500 mt-1">
          Register a new patient and initialize therapy calendar
        </p>
      </div>

      {error && (
        <div
          data-testid="create-case-error"
          className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-[13px] flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Patient Section */}
      <div className="space-y-3.5">
        <h3 className="text-[14px] font-semibold uppercase tracking-wide text-stone-700 border-b border-stone-100 pb-1">
          1. Patient Details
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-[14px] font-semibold tracking-wide uppercase text-stone-700">
              Patient Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              data-testid="patient-name-input"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              onFocus={scrollInputIntoViewOnFocus}
              placeholder="e.g. Ramesh Kumar"
              autoCapitalize="words"
              enterKeyHint="next"
              className="w-full min-h-[48px] border border-stone-300 px-3.5 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
              required
            />
            {fieldErrors.patientName && (
              <p className="text-[13px] text-red-600">{fieldErrors.patientName}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[14px] font-semibold tracking-wide uppercase text-stone-700">
                Age (0–120) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                enterKeyHint="next"
                data-testid="patient-age-input"
                value={age}
                onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                onFocus={scrollInputIntoViewOnFocus}
                min={0}
                max={120}
                placeholder="Age"
                className="w-full min-h-[48px] border border-stone-300 px-3.5 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
                required
              />
              {fieldErrors.age && (
                <p className="text-[13px] text-red-600">{fieldErrors.age}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[14px] font-semibold tracking-wide uppercase text-stone-700">
                Sex <span className="text-red-500">*</span>
              </label>
              <select
                data-testid="patient-sex-select"
                value={sex}
                onChange={(e) => setSex(e.target.value as any)}
                className="w-full min-h-[48px] border border-stone-300 px-3 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Problem Section */}
      <div className="space-y-3.5">
        <h3 className="text-[14px] font-semibold uppercase tracking-wide text-stone-700 border-b border-stone-100 pb-1">
          2. Clinical Problem
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-[14px] font-semibold tracking-wide uppercase text-stone-700">
              Problem (Primary Complaint) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              data-testid="problem-input"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              onFocus={scrollInputIntoViewOnFocus}
              placeholder="e.g. Post-stroke hemiparesis with left arm weakness"
              autoCapitalize="sentences"
              enterKeyHint="next"
              className="w-full min-h-[48px] border border-stone-300 px-3.5 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
              required
            />
            {fieldErrors.problem && (
              <p className="text-[13px] text-red-600">{fieldErrors.problem}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[14px] font-semibold tracking-wide uppercase text-stone-700">
              Present Condition <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              data-testid="present-condition-input"
              value={presentCondition}
              onChange={(e) => setPresentCondition(e.target.value)}
              onFocus={scrollInputIntoViewOnFocus}
              placeholder="e.g. Limited mobility, difficulty gripping objects"
              autoCapitalize="sentences"
              enterKeyHint="next"
              className="w-full min-h-[48px] border border-stone-300 px-3.5 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
              required
            />
            {fieldErrors.presentCondition && (
              <p className="text-[13px] text-red-600">{fieldErrors.presentCondition}</p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Service Section */}
      <div className="space-y-3.5">
        <h3 className="text-[14px] font-semibold uppercase tracking-wide text-stone-700 border-b border-stone-100 pb-1">
          3. Service
        </h3>
        <div className="space-y-1.5">
          <label className="block text-[14px] font-semibold tracking-wide uppercase text-stone-700">
            Clinical Service <span className="text-red-500">*</span>
          </label>
          <select
            data-testid="service-select"
            value={service}
            onChange={(e) => setService(e.target.value as ServiceType)}
            className="w-full min-h-[48px] border border-stone-300 px-3.5 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-medium"
          >
            {CLINICAL_SERVICES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Dates & Place Section */}
      <div className="space-y-3.5">
        <h3 className="text-[14px] font-semibold uppercase tracking-wide text-stone-700 border-b border-stone-100 pb-1">
          4. Schedule & Location
        </h3>
        <div className="space-y-3">
          {/* Branch */}
          <div className="space-y-1.5">
            <label className="block text-[14px] font-semibold tracking-wide uppercase text-stone-700">
              Branch <span className="text-red-500">*</span>
            </label>
            {branches.length === 1 ? (
              <div
                data-testid="branch-single-label"
                className="w-full min-h-[48px] border border-stone-200 bg-stone-50 px-3.5 py-3 text-base font-semibold text-stone-800 rounded-none flex items-center justify-between"
              >
                <span>{branches[0].name}</span>
                <span className="text-[11px] uppercase tracking-wider text-[#0B7A63] font-bold bg-[#e6f4f1] px-2 py-0.5">
                  Assigned
                </span>
                <input type="hidden" name="branchId" value={branches[0].id} />
              </div>
            ) : (
              <select
                data-testid="branch-select"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full min-h-[48px] border border-stone-300 px-3.5 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-medium"
                required
              >
                {branches.length === 0 ? (
                  <option value="">No branches available</option>
                ) : (
                  branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Room */}
            <div className="space-y-1.5">
              <label className="block text-[14px] font-semibold tracking-wide uppercase text-stone-700">
                Room <span className="text-red-500">*</span>
              </label>
              {loadingRooms ? (
                <div className="w-full min-h-[48px] border border-stone-200 px-3.5 py-3 text-base text-stone-400 bg-stone-50">
                  Checking...
                </div>
              ) : availableRooms.length === 0 ? (
                <div
                  data-testid="no-free-rooms-warning"
                  className="w-full min-h-[48px] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 rounded-none font-medium leading-tight flex items-center"
                >
                  No free rooms.
                </div>
              ) : (
                <select
                  data-testid="room-select"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full min-h-[48px] border border-stone-300 px-3 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-medium"
                  required
                >
                  {availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNo}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.roomId && (
                <p data-testid="room-error" className="text-[13px] text-red-600">
                  {fieldErrors.roomId}
                </p>
              )}
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="block text-[14px] font-semibold tracking-wide uppercase text-stone-700">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                data-testid="start-date-input"
                value={startDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-h-[48px] border border-stone-300 px-3 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
                required
              />
              {fieldErrors.startDate && (
                <p className="text-[13px] text-red-600">{fieldErrors.startDate}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Photo Section */}
      <div className="space-y-3.5">
        <h3 className="text-[14px] font-semibold uppercase tracking-wide text-stone-700 border-b border-stone-100 pb-1">
          5. Joining Condition Photos (1 to 3) <span className="text-red-500">*</span>
        </h3>

        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-[13px]">
          <strong>Privacy Notice:</strong> Photos are patient health data. Capture only with patient consent.
        </div>

        {/* Hidden File Inputs for Native Camera and File Picker */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoUpload}
          className="sr-only"
        />
        <input
          ref={galleryInputRef}
          data-testid="joining-photo-input"
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="sr-only"
        />

        {/* Upload Action Buttons */}
        {photos.length < 3 && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[48px] h-[48px] bg-[#0B7A63] hover:bg-[#086350] active:bg-[#064e3e] text-white flex items-center justify-center gap-2 text-[14px] font-semibold uppercase tracking-wider rounded-none transition-colors cursor-pointer select-none touch-manipulation shadow-xs"
            >
              <Camera className="w-5 h-5" />
              <span>Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[48px] h-[48px] bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-300 flex items-center justify-center gap-2 text-[14px] font-semibold uppercase tracking-wider rounded-none transition-colors cursor-pointer select-none touch-manipulation"
            >
              <ImageIcon className="w-5 h-5 text-slate-600" />
              <span>Gallery</span>
            </button>
          </div>
        )}

        {isCompressing && (
          <div className="p-2.5 bg-sky-50 border border-sky-200 text-sky-800 text-[13px] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>Optimizing photo for upload...</span>
          </div>
        )}

        {/* Photos Preview Grid */}
        <div className="flex flex-wrap gap-3 items-center pt-1">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="relative w-28 h-28 border-2 border-stone-300 bg-stone-100 rounded-none overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={`Joining preview ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                data-testid="remove-photo-btn"
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 min-h-[44px] min-w-[44px] bg-red-600 text-white rounded-none flex items-center justify-center shadow-xs cursor-pointer select-none touch-manipulation"
                title="Remove photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {fieldErrors.photos && (
          <p className="text-[13px] text-red-600">{fieldErrors.photos}</p>
        )}
      </div>

      {/* 6. Consent Checkbox */}
      <div className="pt-2 border-t border-stone-200">
        <label className="flex items-start gap-3 cursor-pointer select-none touch-manipulation">
          <input
            type="checkbox"
            data-testid="consent-checkbox"
            checked={consentObtained}
            onChange={(e) => setConsentObtained(e.target.checked)}
            className="mt-1 h-5 w-5 rounded-none border-stone-300 text-[#0B7A63] focus:ring-[#0B7A63]"
            required
          />
          <span className="text-[14px] text-stone-800 font-semibold">
            Consent obtained <span className="text-red-500">*</span>
            <span className="block text-[13px] font-normal text-stone-500 mt-0.5">
              I certify that explicit informed consent for recording clinical details and condition photos was obtained from the patient or legal guardian.
            </span>
          </span>
        </label>
        {fieldErrors.consentObtained && (
          <p className="text-[13px] text-red-600 mt-1">{fieldErrors.consentObtained}</p>
        )}
      </div>

      {/* Fixed Save & Create Case Action Bar above Tab Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto z-30 bg-white/95 backdrop-blur-md p-3 border-t border-stone-200 flex items-center justify-between gap-3 shadow-[0_-2px_12px_rgba(15,23,42,0.08)] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        style={{ bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : 0 }}
      >
        <button
          type="button"
          onClick={() => {
            if (isDirty && !confirm("Discard unsaved case information?")) return;
            router.push("/therapist/dashboard");
          }}
          className="min-h-[52px] h-[52px] px-5 border border-stone-300 text-stone-700 hover:bg-stone-50 text-[14px] font-semibold uppercase tracking-wider rounded-none transition-colors select-none touch-manipulation"
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="submit-case-btn"
          disabled={loading || isCompressing || !isOnline}
          className="flex-1 min-h-[52px] h-[52px] inline-flex items-center justify-center gap-2 bg-[#0B7A63] hover:bg-[#096350] active:bg-[#064e3e] text-white text-base font-semibold uppercase tracking-wider rounded-none transition-colors disabled:opacity-50 select-none touch-manipulation shadow-xs"
        >
          {!isOnline
            ? "Connect to save"
            : loading
            ? "Creating Case..."
            : "Save & Create Case"}
        </button>
      </div>
    </form>
  );
}
