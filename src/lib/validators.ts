import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please provide a valid email address")
    .toLowerCase(),
  password: z
    .string()
    .min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const manualPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

// Admin Management
export const createAdminSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Please provide a valid email address")
      .toLowerCase(),
    phone: z.string().trim().optional().or(z.literal("")),
    password: manualPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export const editAdminSchema = z.object({
  id: z.string().uuid("Invalid user ID"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please provide a valid email address")
    .toLowerCase(),
  phone: z.string().trim().optional().or(z.literal("")),
});

export type EditAdminInput = z.infer<typeof editAdminSchema>;

export const toggleUserStatusSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  isActive: z.boolean(),
});

export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;

export const resetUserPasswordSchema = z
  .object({
    userId: z.string().uuid("Invalid user ID"),
    password: manualPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

export const deleteUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  confirmEmail: z.string().trim().min(1, "Please type the email to confirm").toLowerCase(),
});

export type DeleteUserInput = z.infer<typeof deleteUserSchema>;

// Therapist Management
export const createTherapistSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Please provide a valid email address")
      .toLowerCase(),
    phone: z.string().trim().min(5, "Phone number is required"),
    specialization: z.string().trim().min(2, "Specialization is required"),
    experienceYears: z.coerce
      .number()
      .min(0, "Experience years must be 0 or greater"),
    maxOpenCases: z.coerce
      .number()
      .min(1, "Max open cases must be at least 1")
      .default(10),
    password: manualPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type CreateTherapistInput = z.infer<typeof createTherapistSchema>;

export const editTherapistSchema = z.object({
  id: z.string().uuid("Invalid therapist ID"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please provide a valid email address")
    .toLowerCase(),
  phone: z.string().trim().min(5, "Phone number is required"),
  specialization: z.string().trim().min(2, "Specialization is required"),
  experienceYears: z.coerce
    .number()
    .min(0, "Experience years must be 0 or greater"),
  maxOpenCases: z.coerce
    .number()
    .min(1, "Max open cases must be at least 1"),
});

export type EditTherapistInput = z.infer<typeof editTherapistSchema>;

// Stage 2: Case Management
export const casePriorityEnum = z.enum(["low", "medium", "high", "urgent"]);
export const caseStatusEnum = z.enum([
  "new",
  "assigned",
  "accepted",
  "in_progress",
  "on_hold",
  "completed",
]);
export const caseOutcomeEnum = z.enum(["successful", "unsuccessful", "referred"]);
export const sessionStatusEnum = z.enum(["held", "missed", "cancelled"]);

export const createCaseSchema = z.object({
  clientName: z.string().trim().min(2, "Client name is required"),
  clientEmail: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please provide a valid client email")
    .toLowerCase(),
  clientPhone: z.string().trim().min(5, "Client phone is required"),
  clientAge: z.coerce
    .number()
    .min(1, "Age must be at least 1")
    .max(120, "Age must be realistic")
    .default(25),
  clientGender: z.string().trim().default("Not specified"),
  clientEmergencyContact: z.string().trim().optional(),
  category: z.string().trim().min(2, "Category is required").default("Individual Therapy"),
  presentingIssues: z
    .string()
    .trim()
    .min(5, "Presenting issues description must be at least 5 characters"),
  priority: casePriorityEnum.default("medium"),
  initialNotes: z.string().trim().optional(),
  assignedTherapistId: z.string().uuid().optional().or(z.literal("")),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const assignCaseSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
  therapistId: z.string().uuid("Invalid therapist ID"),
  notes: z.string().trim().optional(),
});

export type AssignCaseInput = z.infer<typeof assignCaseSchema>;

export const acceptCaseSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
});

export type AcceptCaseInput = z.infer<typeof acceptCaseSchema>;

export const declineCaseSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
  reason: z
    .string()
    .trim()
    .min(10, "Please provide a detailed decline reason (at least 10 characters)"),
});

export type DeclineCaseInput = z.infer<typeof declineCaseSchema>;

export const updateCaseStatusSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
  status: caseStatusEnum,
  notes: z.string().trim().optional(),
});

export type UpdateCaseStatusInput = z.infer<typeof updateCaseStatusSchema>;

export const closeCaseSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
  outcome: caseOutcomeEnum,
  closingNotes: z.string().trim().optional(),
});

export type CloseCaseInput = z.infer<typeof closeCaseSchema>;

export const addNoteSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
  note: z.string().trim().min(10, "Note must be at least 10 characters long"),
  isPrivate: z.boolean().optional().default(false),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;

export const scheduleSessionSchema = z.object({
  caseId: z.string().uuid("Invalid case ID"),
  scheduledAt: z.string().min(1, "Scheduled date/time is required"),
  durationMinutes: z.coerce.number().min(15).max(180).default(60),
  notes: z.string().trim().optional(),
  therapistId: z.string().uuid("Invalid therapist ID").optional(),
  roomNo: z.string().trim().max(50).optional(),
});

export type ScheduleSessionInput = z.infer<typeof scheduleSessionSchema>;

export const updateSessionStatusSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  status: sessionStatusEnum,
  notes: z.string().trim().optional(),
});

export type UpdateSessionStatusInput = z.infer<typeof updateSessionStatusSchema>;

// Stage 2: Password Reset
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please provide a valid email address")
    .toLowerCase(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

