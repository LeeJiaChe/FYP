import re

def main():
    # 1. Update MyBookingsTab.tsx
    my_bookings_path = "/mnt/j/FYPBusSystem/components/student/MyBookingsTab.tsx"
    with open(my_bookings_path, "r") as f:
        mb = f.read()
    
    # Push the cancel button away using ml-auto
    mb = mb.replace(
        'className="btn-ghost text-xs disabled:opacity-50 disabled:cursor-not-allowed"',
        'className="btn-ghost text-xs disabled:opacity-50 disabled:cursor-not-allowed ml-auto"'
    )
    with open(my_bookings_path, "w") as f:
        f.write(mb)
    

    # 2. Update app/student/page.tsx
    student_path = "/mnt/j/FYPBusSystem/app/student/page.tsx"
    with open(student_path, "r") as f:
        st = f.read()

    # Import ConfirmModal
    if "import ConfirmModal" not in st:
        st = st.replace('import Navbar from "@/components/Navbar";', 'import Navbar from "@/components/Navbar";\nimport ConfirmModal from "@/components/ConfirmModal";')

    # Add state for ConfirmModal
    if "const [confirmCancelId" not in st:
        st = st.replace(
            'const [bookingLoading, setBookingLoading] = useState(false);',
            'const [bookingLoading, setBookingLoading] = useState(false);\n  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);'
        )

    # Change handleCancelBooking
    handle_cancel_old = """  async function handleCancelBooking(bookingId: string) {
    // We remove the native confirm since it was a requirement in Tier 2 to replace it with a modal, 
    // but the prompt says Tier 1 #4 is just to fix the silent catch and add toast.
    // Actually, Tier 2 #6 says "Replace native confirm() dialogs with a proper in-app modal component".
    // For now we will keep confirm in Tier 1 and fix it in Tier 2 or we can just keep it and add toast.
    if (!confirm("Are you sure you want to cancel this booking?")) return;"""
    
    handle_cancel_new = """  async function handleCancelBooking(bookingId: string) {"""
    st = st.replace(handle_cancel_old, handle_cancel_new)
    
    # Actually wait, `handleCancelBooking` is called from the button. Let's redirect the button to set `confirmCancelId`.
    # Wait, the button calls `onCancelBooking(b.id)` which is passed to `MyBookingsTab`.
    # In `app/student/page.tsx`:
    # `<MyBookingsTab ... onCancelBooking={handleCancelBooking} />` ->
    # `<MyBookingsTab ... onCancelBooking={(id) => setConfirmCancelId(id)} />`
    st = st.replace('onCancelBooking={handleCancelBooking}', 'onCancelBooking={(id) => setConfirmCancelId(id)}')
    
    # Add <ConfirmModal> at the end of the return statement
    if "<ConfirmModal" not in st:
        st = st.replace(
            '    </div>\n  );\n}',
            '      <ConfirmModal\n        isOpen={!!confirmCancelId}\n        onClose={() => setConfirmCancelId(null)}\n        onConfirm={() => { if (confirmCancelId) handleCancelBooking(confirmCancelId); }}\n        title="Cancel Booking"\n        message="Are you sure you want to cancel this booking? This action cannot be undone."\n        confirmText="Yes, Cancel Booking"\n        cancelText="Keep Booking"\n        isDestructive={true}\n      />\n    </div>\n  );\n}'
        )
        
    # Tone down "Join Waitlist" button
    st = st.replace(
        'className="btn-primary w-full py-4 text-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 border-none shadow-lg shadow-amber-600/30 font-bold"',
        'className="w-full py-4 text-lg border border-amber-500/50 text-amber-500 hover:bg-amber-500/10 font-bold rounded-xl transition-colors"'
    )
        
    with open(student_path, "w") as f:
        f.write(st)


    # 3. Update app/driver/page.tsx
    driver_path = "/mnt/j/FYPBusSystem/app/driver/page.tsx"
    with open(driver_path, "r") as f:
        dr = f.read()

    # Import ConfirmModal and Modal
    if "import ConfirmModal" not in dr:
        dr = dr.replace('import QRScannerModal from "@/components/QRScannerModal";', 'import QRScannerModal from "@/components/QRScannerModal";\nimport ConfirmModal from "@/components/ConfirmModal";\nimport Modal from "@/components/Modal";')

    # Add state for ConfirmModal (Start/End trip + Checkin)
    if "const [confirmAction" not in dr:
        dr = dr.replace(
            'const [updatingDelay, setUpdatingDelay] = useState(false);',
            'const [updatingDelay, setUpdatingDelay] = useState(false);\n  const [confirmAction, setConfirmAction] = useState<{title: string, message: string, onConfirm: () => void, isDestructive?: boolean} | null>(null);'
        )

    # Change handleUpdateTripStatus
    dr = re.sub(
        r'if \(!confirm\(`Are you sure you want to mark this trip as \$\{newStatus\}\?`\)\) return;',
        '',
        dr
    )
    # The buttons call handleUpdateTripStatus directly, we will intercept them.
    dr = dr.replace(
        'onClick={() => handleUpdateTripStatus("DEPARTED")}',
        'onClick={() => setConfirmAction({ title: "Start Trip", message: "Are you sure you want to mark this trip as DEPARTED?", onConfirm: () => handleUpdateTripStatus("DEPARTED") })}'
    )
    dr = dr.replace(
        'onClick={() => handleUpdateTripStatus("ARRIVED")}',
        'onClick={() => setConfirmAction({ title: "End Trip", message: "Are you sure you want to mark this trip as ARRIVED?", onConfirm: () => handleUpdateTripStatus("ARRIVED") })}'
    )

    # Change handleManualCheckIn
    dr = dr.replace(
        'onClick={() => handleManualCheckIn(seat)}',
        'onClick={() => setConfirmAction({ title: "Manual Check-In", message: `Check in ${seat.booking?.studentName}?`, onConfirm: () => handleManualCheckIn(seat) })}'
    )
    dr = re.sub(
        r'if \(!confirm\(`Manually check in \$\{seat\.booking\.studentName\}\?`\)\) return;',
        '',
        dr
    )

    # Add ConfirmModal
    if "<ConfirmModal" not in dr:
        dr = dr.replace(
            '    </div>\n  );\n}',
            '      <ConfirmModal\n        isOpen={!!confirmAction}\n        onClose={() => setConfirmAction(null)}\n        onConfirm={() => { if (confirmAction) confirmAction.onConfirm(); }}\n        title={confirmAction?.title || ""}\n        message={confirmAction?.message || ""}\n        confirmText="Confirm"\n        isDestructive={confirmAction?.isDestructive}\n      />\n    </div>\n  );\n}'
        )

    # Replace hardcoded tailwind with shared Modal for Report Delay
    delay_modal_old = """      {/* Delay Modal */}
      {showDelayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Report Delay or Issue
            </h3>
            <p className="text-sm text-slate-400">
              Notify students about unexpected delays.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleReportDelay("DELAYED", "Traffic delay")}
                disabled={updatingDelay}
                className="w-full p-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-left transition-colors"
              >
                <div className="font-bold text-white">Traffic Delay</div>
                <div className="text-xs text-slate-400">Moderate delay</div>
              </button>
              
              <button
                onClick={() => handleReportDelay("DELAYED", "Bus breakdown")}
                disabled={updatingDelay}
                className="w-full p-4 rounded-xl border border-amber-900/30 bg-amber-900/10 hover:bg-amber-900/20 text-left transition-colors"
              >
                <div className="font-bold text-amber-500">Bus Breakdown</div>
                <div className="text-xs text-amber-700">Significant delay</div>
              </button>
            </div>

            <button
              onClick={() => setShowDelayModal(false)}
              className="w-full p-3 rounded-xl font-bold text-sm text-slate-400 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}"""
    
    delay_modal_new = """      {/* Delay Modal */}
      <Modal isOpen={showDelayModal} onClose={() => setShowDelayModal(false)} title="Report Delay or Issue" maxWidth="sm">
        <div className="space-y-4 mt-2">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Notify students about unexpected delays.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => handleReportDelay("DELAYED", "Traffic delay")}
              disabled={updatingDelay}
              className="w-full p-4 rounded-xl text-left transition-colors"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <div className="font-bold" style={{ color: "var(--text-primary)" }}>Traffic Delay</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Moderate delay</div>
            </button>
            
            <button
              onClick={() => handleReportDelay("DELAYED", "Bus breakdown")}
              disabled={updatingDelay}
              className="w-full p-4 rounded-xl text-left transition-colors"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              <div className="font-bold" style={{ color: "#fbbf24" }}>Bus Breakdown</div>
              <div className="text-xs" style={{ color: "#d97706" }}>Significant delay</div>
            </button>
          </div>
        </div>
      </Modal>"""
    
    dr = dr.replace(delay_modal_old, delay_modal_new)
    
    # Fix mobile scroll entrapment on the student manifest list
    # The list is `<div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">`
    dr = dr.replace(
        'className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"',
        'className="space-y-3 md:max-h-[400px] md:overflow-y-auto pr-2 custom-scrollbar"'
    )

    # Finally, swap Driver's overall layout from hardcoded tailwind to theme variables
    dr = dr.replace('className="min-h-screen bg-slate-950 text-slate-100 font-sans"', 'className="min-h-screen font-sans" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}')
    
    with open(driver_path, "w") as f:
        f.write(dr)
        
    print("Tier 2 successfully completed!")

if __name__ == '__main__':
    main()
