"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CLINICAL_SERVICES } from "@/lib/services";
import { type Branch, type ServiceType } from "@/db/schema";
import {
  createCaseTherapistAction,
  type CreateCasePhotoInput,
} from "@/lib/actions/case-creation-actions";
import { getFreeRoomsForBranchAction } from "@/lib/actions/room-management-actions";
import { getTodayIST, getDaysAgoIST, getDaysAheadIST } from "@/lib/date-utils";
import {
  Upload,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface CreateCaseFormProps {
  branches: Branch[];
}

export function CreateCaseForm({ branches }: CreateCaseFormProps) {
  const router = useRouter();

  // Form State
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<"male" | "female" | "other">("male");
  const [problem, setProblem] = useState("");
  const [presentCondition, setPresentCondition] = useState("");
  const [service, setService] = useState<ServiceType>("physiotherapy");
  const [startDate, setStartDate] = useState(getTodayIST());
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [roomId, setRoomId] = useState("");
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ id: string; roomNo: string }>
  >([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [consentObtained, setConsentObtained] = useState(false);

  const fetchRooms = React.useCallback(async (bId: string) => {
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

  React.useEffect(() => {
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

  // Client-side image compression: max 1600px width/height, max 5MB
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 3) {
      setError("You can upload a maximum of 3 joining condition photos.");
      return;
    }

    Array.from(files).forEach((file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Only JPEG, PNG, and WebP images are allowed.");
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

    if (!consentObtained) {
      setError("Consent is mandatory before creating a clinical case.");
      setFieldErrors({ consentObtained: "You must confirm consent obtained." });
      return;
    }

    if (photos.length === 0) {
      setError("At least one joining condition photo is required.");
      setFieldErrors({ photos: "Joining condition photo is required." });
      return;
    }

    if (age === "" || isNaN(Number(age))) {
      setError("Please enter a valid age.");
      setFieldErrors({ age: "Age is required." });
      return;
    }

    if (!roomId) {
      setError("No free rooms in this branch. Ask your admin to add a room.");
      setFieldErrors({ roomId: "No free rooms in this branch. Ask your admin to add a room." });
      return;
    }

    setLoading(true);

    try {
      const res = await createCaseTherapistAction({
        patientName,
        age: Number(age),
        sex,
        problem,
        presentCondition,
        service,
        startDate,
        roomId,
        branchId,
        consentObtained: true,
        photos: photos.map((p) => ({
          base64Data: p.base64Data,
          filename: p.filename,
          contentType: p.contentType,
        })),
      });

      setLoading(false);

      if (res.success && res.caseId && res.patientId) {
        setCreatedResult({
          caseId: res.caseId,
          patientId: res.patientId,
          caseNumber: res.caseNumber || res.patientId,
        });
      } else {
        setError(res.error || "Failed to create case.");
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      }
    } catch {
      setLoading(false);
      setError("An unexpected error occurred while saving the case.");
    }
  };

  // Success Screen
  if (createdResult) {
    return (
      <div
        data-testid="create-case-success"
        className="max-w-xl mx-auto my-12 bg-white border-2 border-stone-900 p-8 shadow-xl rounded-none text-center"
      >
        <div className="w-16 h-16 bg-emerald-100 text-emerald-800 border-2 border-emerald-300 mx-auto flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-[#0B7A63]" />
        </div>

        <h2 className="text-2xl font-bold uppercase tracking-tight text-stone-900 mb-2">
          Case Created Successfully
        </h2>
        <p className="text-xs text-stone-500 mb-6">
          The case has been registered and assigned to you.
        </p>

        <div className="bg-stone-50 border border-stone-200 p-6 mb-8 space-y-3">
          <div>
            <span className="text-xs uppercase font-semibold text-stone-500 block">
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

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            data-testid="go-to-case-btn"
            onClick={() => router.push(`/therapist/cases/${createdResult.caseId}`)}
            className="inline-flex items-center justify-center gap-2 bg-[#0B7A63] hover:bg-[#096350] text-white px-6 py-3 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
          >
            <span>Open Case & Calendar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/therapist/dashboard")}
            className="border border-stone-300 hover:bg-stone-100 text-stone-700 px-6 py-3 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
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
      className="space-y-8 max-w-3xl mx-auto bg-white border border-stone-200 p-8 shadow-xs rounded-none"
    >
      <div className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-tight text-stone-900">
          Create Case
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          Register a new patient and initialize therapy calendar
        </p>
      </div>

      {error && (
        <div
          data-testid="create-case-error"
          className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Patient Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100 pb-1">
          1. Patient Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-stone-700">
              Patient Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              data-testid="patient-name-input"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
              required
            />
            {fieldErrors.patientName && (
              <p className="text-[11px] text-red-600">{fieldErrors.patientName}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">
              Age (0–120) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              data-testid="patient-age-input"
              value={age}
              onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
              max={120}
              placeholder="Age"
              className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
              required
            />
            {fieldErrors.age && (
              <p className="text-[11px] text-red-600">{fieldErrors.age}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-stone-700">
            Sex <span className="text-red-500">*</span>
          </label>
          <select
            data-testid="patient-sex-select"
            value={sex}
            onChange={(e) => setSex(e.target.value as any)}
            className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* 2. Problem Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100 pb-1">
          2. Clinical Problem
        </h3>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-stone-700">
            Problem (Primary Complaint) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            data-testid="problem-input"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="e.g. Post-stroke hemiparesis with left arm weakness"
            className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
            required
          />
          {fieldErrors.problem && (
            <p className="text-[11px] text-red-600">{fieldErrors.problem}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-stone-700">
            Present Condition <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            data-testid="present-condition-input"
            value={presentCondition}
            onChange={(e) => setPresentCondition(e.target.value)}
            placeholder="e.g. Limited mobility, difficulty gripping objects"
            className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
            required
          />
          {fieldErrors.presentCondition && (
            <p className="text-[11px] text-red-600">{fieldErrors.presentCondition}</p>
          )}
        </div>
      </div>

      {/* 3. Service Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100 pb-1">
          3. Service
        </h3>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-stone-700">
            Clinical Service <span className="text-red-500">*</span>
          </label>
          <select
            data-testid="service-select"
            value={service}
            onChange={(e) => setService(e.target.value as ServiceType)}
            className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-medium"
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
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100 pb-1">
          4. Schedule & Location
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Branch First */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">
              Branch <span className="text-red-500">*</span>
            </label>
            {branches.length === 1 ? (
              <div
                data-testid="branch-single-label"
                className="w-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800 rounded-none flex items-center justify-between"
              >
                <span>{branches[0].name}</span>
                <span className="text-[10px] uppercase tracking-wider text-[#0B7A63] font-semibold bg-[#e6f4f1] px-1.5 py-0.5">
                  Assigned
                </span>
                <input type="hidden" name="branchId" value={branches[0].id} />
              </div>
            ) : (
              <select
                data-testid="branch-select"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-medium"
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

          {/* 2. Room Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">
              Room <span className="text-red-500">*</span>
            </label>
            {loadingRooms ? (
              <div className="w-full border border-stone-200 px-3 py-2 text-xs text-stone-400 bg-stone-50 font-mono">
                Checking rooms...
              </div>
            ) : availableRooms.length === 0 ? (
              <div
                data-testid="no-free-rooms-warning"
                className="w-full border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 rounded-none font-medium leading-tight"
              >
                No free rooms in this branch. Ask your admin to add a room.
              </div>
            ) : (
              <select
                data-testid="room-select"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-medium"
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
              <p data-testid="room-error" className="text-[11px] text-red-600">
                {fieldErrors.roomId}
              </p>
            )}
          </div>

          {/* 3. Start Date */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-700">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              data-testid="start-date-input"
              value={startDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
              required
            />
            <p className="text-[10px] text-stone-400">Past or future ±30 days</p>
            {fieldErrors.startDate && (
              <p className="text-[11px] text-red-600">{fieldErrors.startDate}</p>
            )}
          </div>
        </div>
      </div>

      {/* 5. Photo Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100 pb-1">
          5. Joining Condition Photos (1 to 3) <span className="text-red-500">*</span>
        </h3>

        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <strong>Privacy Notice:</strong> Photos are patient data. Take them only with the patient's or guardian's consent.
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="relative w-28 h-28 border-2 border-stone-300 bg-stone-100 rounded-none overflow-hidden group"
            >
              <img
                src={photo.previewUrl}
                alt={`Joining preview ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                data-testid="remove-photo-btn"
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-none opacity-90 hover:opacity-100 transition-opacity"
                title="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {photos.length < 3 && (
            <label className="w-28 h-28 border-2 border-dashed border-stone-300 hover:border-[#0B7A63] flex flex-col items-center justify-center cursor-pointer bg-stone-50 hover:bg-stone-100 transition-colors rounded-none p-2 text-center">
              <Camera className="w-6 h-6 text-stone-400 mb-1" />
              <span className="text-[11px] font-semibold text-stone-600">
                {photos.length === 0 ? "Add Photo" : "Add Another"}
              </span>
              <span className="text-[9px] text-stone-400">Camera / Files</span>
              <input
                type="file"
                data-testid="joining-photo-input"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
        {fieldErrors.photos && (
          <p className="text-[11px] text-red-600">{fieldErrors.photos}</p>
        )}
      </div>

      {/* 6. Consent Checkbox */}
      <div className="pt-2 border-t border-stone-200">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            data-testid="consent-checkbox"
            checked={consentObtained}
            onChange={(e) => setConsentObtained(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded-none border-stone-300 text-[#0B7A63] focus:ring-[#0B7A63]"
            required
          />
          <span className="text-xs text-stone-800 font-semibold select-none">
            Consent obtained <span className="text-red-500">*</span>
            <span className="block text-[11px] font-normal text-stone-500 mt-0.5">
              I certify that explicit informed consent for recording clinical details and condition photos was obtained from the patient or legal guardian.
            </span>
          </span>
        </label>
        {fieldErrors.consentObtained && (
          <p className="text-[11px] text-red-600 mt-1">{fieldErrors.consentObtained}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
        <button
          type="button"
          onClick={() => router.push("/therapist/dashboard")}
          className="px-5 py-2.5 border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="submit-case-btn"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-[#0B7A63] hover:bg-[#096350] text-white px-6 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors disabled:opacity-50"
        >
          {loading ? "Creating Case..." : "Save & Create Case"}
        </button>
      </div>
    </form>
  );
}
