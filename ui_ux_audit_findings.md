# UI/UX Audit Findings: FYP Bus System

Based on a deep independent review of the frontend codebase (`app/student/page.tsx`, `app/driver/page.tsx`, `app/admin/page.tsx`, and associated components), I've identified several significant UX flaws, missing features, and inconsistencies. 

Here are the concrete issues mapped to the dimensions you requested:

## 1. UI-Logic Mismatch (Critical Functional Gaps)
* **[Driver] [Issue]** Missing "Depart" and "Arrive" actions. 
  * **[Why it's a problem]** The backend cron job penalizes students if the trip passes its boarding deadline and isn't marked `DEPARTED` or `ARRIVED`. Since the driver UI only allows reporting a delay/cancellation, the trip stays in `SCHEDULED` status forever. **Every student who doesn't check in will incorrectly receive a penalty when the cron runs.**
  * **[Proposed fix]** Add a prominent "Start Trip" (changes status to `DEPARTED`) and "End Trip" (`ARRIVED`) action in the Driver Console.
* **[Admin] [Issue]** Missing "Edit Bus" functionality.
  * **[Why it's a problem]** The backend has complex logic specifically to prevent admins from reducing bus capacity if there are active trips (which we just verified in the E2E tests). However, the Admin UI only has an "Add Bus" button. Admins physically cannot edit buses from the UI.
  * **[Proposed fix]** Add an "Edit" button to each bus card in `BusesTab` that opens a modal to update the plate/capacity.
* **[Student] [Issue]** Cancellation deadline not enforced visually.
  * **[Why it's a problem]** The backend rejects cancellations < 30 mins before departure. The UI always shows the "Cancel" button as clickable, regardless of the departure time, leading users into a trap.
  * **[Proposed fix]** Dynamically disable the "Cancel" button and change its text to "Too late to cancel" if `Date.now() > departureTime - 30 mins`.

## 2. Feedback & Loading States
* **[Student] [Issue]** Cancellation errors are silently swallowed.
  * **[Why it's a problem]** If a student clicks Cancel and the API returns a 400 (e.g., within 30 mins of departure), the `catch {}` block in `handleCancelBooking` silently ignores it. The UI doesn't update, and the user gets no feedback.
  * **[Proposed fix]** Implement a global toast notification system (like `react-hot-toast` or `sonner`) and show success/error toasts for all actions.
* **[Admin] [Issue]** No loading states on form submissions.
  * **[Why it's a problem]** When an admin clicks "Create Trip", there is no spinner or disabled state. The button just sits there while the network request is pending.
  * **[Proposed fix]** Add a `isSubmitting` boolean state to all admin modals (Bus, Route, Trip) to disable the submit button and change text to "Creating...".
* **[Student & Driver] [Issue]** Reliance on native `confirm()` dialogs.
  * **[Why it's a problem]** Cancelling a booking (Student) and Manual Check-in (Driver) trigger the ugly, OS-level browser `alert/confirm` boxes. This breaks the immersive app experience.
  * **[Proposed fix]** Replace native `confirm()` with a stylized, in-app Confirmation Modal component matching the PWA's design system.

## 3. Consistency (Cross-Dashboard)
* **[Driver vs Others] [Issue]** Hardcoded Tailwind vs. CSS Variables.
  * **[Why it's a problem]** The Admin and Student dashboards use CSS variables (`var(--bg-base)`, `var(--text-primary)`) for theming. The Driver dashboard hardcodes utility classes (`bg-slate-950 text-slate-100`). If you ever update your app's theme colors, the Driver dashboard will break visually.
  * **[Proposed fix]** Refactor `app/driver/page.tsx` to use the same CSS variable tokens as the other dashboards.
* **[Driver vs Others] [Issue]** Modal implementations are completely different.
  * **[Why it's a problem]** Student/Admin modals use a standard `<div className="modal-overlay">` class. The Driver delay modal manually writes out `<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">`.
  * **[Proposed fix]** Create a shared `<Modal>` UI component used uniformly across all 3 roles.

## 4. Visual Hierarchy
* **[Student] [Issue]** "Join Waitlist" button styling is overpowering.
  * **[Why it's a problem]** "Confirm Booking" is a standard primary button. However, if a trip is full, the fallback "Join Waitlist" button renders with a flashy orange gradient (`linear-gradient(135deg, #d97706, #f59e0b)`). It visually elevates a fallback action to look like a premium feature. *(Note: This is subjective, but standard UX dictates fallback actions shouldn't outshine primary ones).*
  * **[Proposed fix]** Make "Join Waitlist" a standard secondary/outline button with an amber tint, rather than a heavy gradient.
* **[Student] [Issue]** Destructive actions lack visual isolation.
  * **[Why it's a problem]** In `MyBookingsTab`, the "Boarding Pass", "Track", and "Cancel" buttons are clustered together with `gap-2`. A user trying to track their bus on a bumpy ride might easily hit "Cancel".
  * **[Proposed fix]** Push the "Cancel" button to the far right (or bottom) using `ml-auto` to isolate it from the primary engagement actions.

## 5. State Clarity
* **[Admin] [Issue]** Arbitrary progress bar for Bus utilization.
  * **[Why it's a problem]** In `BusesTab`, there is a progress bar for "Trips Scheduled" calculated as `(b._count?.trips || 0) * 10%`. This assumes a bus's maximum capacity is 10 trips. If a bus has 12 trips, the bar breaks 100%. It's misleading data visualization.
  * **[Proposed fix]** Remove the progress bar entirely, or base it on a real metric (e.g., active trips vs total fleet trips).

## 6. Spacing & Alignment & Mobile
* **[Driver] [Issue]** Scroll-entrapment on Student Manifest.
  * **[Why it's a problem]** The manifest list has `max-h-[400px] overflow-y-auto`. On a small mobile screen, if the user tries to scroll the main page down, their finger might get caught scrolling the inner list instead (scroll entrapment).
  * **[Proposed fix]** On mobile breakpoints (`max-w-md`), remove the fixed height and let the list scroll naturally with the document body. Keep the `max-h` only for desktop views.
