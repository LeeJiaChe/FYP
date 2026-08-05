import re

def main():
    # 1. MyBookingsTab.tsx
    my_bookings_path = "/mnt/j/FYPBusSystem/components/student/MyBookingsTab.tsx"
    with open(my_bookings_path, "r") as f:
        mb = f.read()
    
    # Calculate isTooLate for the cancel button
    if "const isTooLate =" not in mb:
        # We need to insert it inside the map
        mb = mb.replace(
            "const isTooLate = new Date(b.trip.departureTime).getTime() - Date.now() < 30 * 60 * 1000;", "" # clean up if already there
        )
        mb = mb.replace(
            "<div\n              key={b.id}",
            "const isTooLate = new Date(b.trip.departureTime).getTime() - Date.now() < 30 * 60 * 1000;\n            return (\n            <div\n              key={b.id}"
        )
        mb = mb.replace(
            "              </div>\n            </div>\n          ))",
            "              </div>\n            </div>\n          );\n          })"
        )
        
        # Replace the Cancel button
        mb = re.sub(
            r'<button\s*onClick=\{\(\) => onCancelBooking\(b\.id\)\}\s*className="btn-ghost text-xs"[^>]*>\s*Cancel\s*</button>',
            """<button
                      onClick={() => onCancelBooking(b.id)}
                      disabled={isTooLate}
                      className="btn-ghost text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        color: "#f87171",
                        borderColor: "rgba(239,68,68,0.3)",
                      }}
                    >
                      {isTooLate ? "Too late to cancel" : "Cancel"}
                    </button>""",
            mb
        )
        
    with open(my_bookings_path, "w") as f:
        f.write(mb)
    
    
    # 2. app/student/page.tsx
    student_path = "/mnt/j/FYPBusSystem/app/student/page.tsx"
    with open(student_path, "r") as f:
        st = f.read()
    
    if "import toast from" not in st:
        st = st.replace('import React, { useState, useEffect } from "react";', 'import React, { useState, useEffect } from "react";\nimport toast from "react-hot-toast";')
    
    st = re.sub(r'catch\s*\(\w*(?:\s*:\s*any)?\)\s*\{\s*\}', 'catch (err: any) { toast.error(err.message || "An error occurred"); }', st)
    st = re.sub(r'catch\s*\{\s*\}', 'catch (err: any) { toast.error(err.message || "An error occurred"); }', st)
    
    handle_cancel_new = """  async function handleCancelBooking(bookingId: string) {
    // We remove the native confirm since it was a requirement in Tier 2 to replace it with a modal, 
    // but the prompt says Tier 1 #4 is just to fix the silent catch and add toast.
    // Actually, Tier 2 #6 says "Replace native confirm() dialogs with a proper in-app modal component".
    // For now we will keep confirm in Tier 1 and fix it in Tier 2 or we can just keep it and add toast.
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      });
      if (res.ok) {
        toast.success("Booking cancelled successfully");
        fetchBookings();
        fetchTrips();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to cancel booking");
      }
    } catch (err: any) { toast.error(err.message || "Network error"); }
  }"""
    st = re.sub(r'async function handleCancelBooking[\s\S]*?catch[^\}]*\}', handle_cancel_new, st)
    
    with open(student_path, "w") as f:
        f.write(st)
        
    
    # 3. Handle Login
    login_path = "/mnt/j/FYPBusSystem/app/login/page.tsx"
    with open(login_path, "r") as f:
        log = f.read()
    if "import toast from" not in log:
        log = log.replace('import { useState } from "react";', 'import { useState } from "react";\nimport toast from "react-hot-toast";')
    log = re.sub(r'catch\s*\{\s*\}', 'catch (err: any) { toast.error(err.message || "An error occurred"); }', log)
    with open(login_path, "w") as f:
        f.write(log)
        
    # 4. Handle Register
    reg_path = "/mnt/j/FYPBusSystem/app/register/page.tsx"
    with open(reg_path, "r") as f:
        reg = f.read()
    if "import toast from" not in reg:
        reg = reg.replace('import { useState } from "react";', 'import { useState } from "react";\nimport toast from "react-hot-toast";')
    reg = re.sub(r'catch\s*\{\s*\}', 'catch (err: any) { toast.error(err.message || "An error occurred"); }', reg)
    with open(reg_path, "w") as f:
        f.write(reg)
        
    # 5. Handle Settings
    set_path = "/mnt/j/FYPBusSystem/app/settings/page.tsx"
    with open(set_path, "r") as f:
        set_c = f.read()
    if "import toast from" not in set_c:
        set_c = set_c.replace('import React, { useState, useEffect } from "react";', 'import React, { useState, useEffect } from "react";\nimport toast from "react-hot-toast";')
    set_c = re.sub(r'catch\s*\(\w*(?:\s*:\s*any)?\)\s*\{\s*\}', 'catch (err: any) { toast.error(err.message || "An error occurred"); }', set_c)
    set_c = re.sub(r'catch\s*\{\s*\}', 'catch (err: any) { toast.error(err.message || "An error occurred"); }', set_c)
    
    # In settings we should also show toast on success
    set_c = set_c.replace('setPassSuccess("Password updated successfully");', 'toast.success("Password updated successfully"); setPassSuccess("Password updated successfully");')
    set_c = set_c.replace('setPassError(data.error ||', 'toast.error(data.error || "Failed"); setPassError(data.error ||')
    
    with open(set_path, "w") as f:
        f.write(set_c)

    print("Student, Login, Register, Settings updated!")

if __name__ == '__main__':
    main()
