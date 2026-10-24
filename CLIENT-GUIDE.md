# Guild Club Services — Client Access & Dashboard Guide

Welcome to the **Guild Club Services** clinical management platform. Below are your demo credentials for the three primary roles, along with a quick overview of how each dashboard operates.

---

## 1. Demo Login Credentials

**Login URL**: 'https://guildclub-services.vercel.app/'

| Role | Email | Password | Dashboard URL | Primary Responsibility |
|---|---|---|---|---|
| **Super Admin** | `superadmin@guildclub.com` | `ChangeMe@12345` | `/super-admin/dashboard` | Executive governance, organization analytics & admin management |
| **Admin** | `admin@guildclub.com` | `Admin@12345` | `/admin/dashboard` | Daily clinical operations, case triage, therapist room assignments |
| **Therapist** | `therapist@guildclub.com` | `Therapist@12345` | `/therapist/dashboard` | Daily session schedule, client case notes & session completions |

*(Note: On first login, any account flagged with temporary credentials will automatically prompt you to set a personal password).*

---

## 2. How Each Dashboard Works

### 1. Super Admin Command Center (`/super-admin/dashboard`)
*Designed for executives, directors, and governance leads.*
* **Executive KPIs & Sparklines**: Instant visibility into total cases created, active open cases, sessions held, and active clinical staff.
* **Clinical Outcome Analytics**:
  - **Success Rate Gauge**: Real-time percentage of cases successfully resolved.
  - **Volume Trends**: 30-day area chart comparing new intakes vs completed cases.
  - **Intake Pipeline Funnel**: Visual tracking of conversion from triage → evaluation → active therapy → discharge.
* **Staff Productivity & Workload**:
  - Workload balance charts by therapist to prevent clinical burnout.
  - Admin operational productivity leaderboard.
  - Daily clinical activity heatmap across calendar days.
* **Governance**: Manage administrators, view audit activity logs, and export institutional compliance reports.

---

### 2. Admin Operations Hub (`/admin/dashboard`)
*Designed for clinic coordinators and operations managers.*
* **Daily Intake Triage**: View new incoming client inquiries, review clinical urgency, and assign primary therapists.
* **Room & Resource Allocation**: Assign daily physical/virtual consultation rooms to active therapists.
* **Case Flow Monitoring**: Track unassigned cases, overdue follow-ups, and session attendance in real-time.
* **Audit & Export Tools**: Filter operational data by date ranges (IST timezone) and export reports to **CSV or PDF** with a single click.

---

### 3. Therapist Session Board (`/therapist/dashboard`)
*Designed for licensed therapists and clinicians.*
* **Daily Session Schedule**: View all scheduled sessions for the selected date, sorted chronologically with patient names and designated consultation rooms.
* **Case Management**: Click any case to view past consultation history, clinical background, and diagnostic notes.
* **Session Completion Workflow**:
  - Record private clinical observations and progress notes.
  - Capture client digital signatures directly on screen.
  - Securely upload session worksheets or photos (encrypted via private cloud blob storage).
  - Mark session as completed to update operational records instantly.

---

## 3. Quick Tips for Testing
1. **Try Date Selection**: Use the date picker on both Admin and Therapist dashboards to view schedules and activity for different days.
2. **Sharp Visual Design**: The entire interface uses high-contrast typography, sharp borders, and responsive charts optimized for desktop, tablet, and mobile.
3. **Health Monitor**: Uptime and database health can be verified at any time at `/api/health`.
