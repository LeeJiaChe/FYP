import re
import sys

def main():
    file_path = '/mnt/j/FYPBusSystem/app/admin/page.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Import toast
    if 'import toast' not in content:
        content = content.replace('import React, { useState, useEffect } from "react";', 'import React, { useState, useEffect } from "react";\nimport toast from "react-hot-toast";')

    # 2. Add state
    if 'const [editingBusId' not in content:
        content = content.replace(
            'const [showBusModal, setShowBusModal] = useState(false);',
            'const [showBusModal, setShowBusModal] = useState(false);\n  const [editingBusId, setEditingBusId] = useState<string | null>(null);\n  const [isSubmitting, setIsSubmitting] = useState(false);'
        )

    # 3. Replace catch {} loops in fetch functions
    # Just catch {} or catch (err) {} or catch { // ignore }
    content = re.sub(r'catch\s*\(\w*(?:\s*:\s*any)?\)\s*\{\s*\}', 'catch (err: any) { toast.error(err.message || "An error occurred"); }', content)
    content = re.sub(r'catch\s*\{\s*\}', 'catch (err: any) { toast.error(err.message || "An error occurred"); }', content)
    content = re.sub(r'catch\s*\{\s*//\s*ignore\s*\}', 'catch (err: any) { toast.error(err.message || "An error occurred"); }', content)

    # 4. handleCreateBus
    handle_create_bus_new = """  async function handleCreateBus(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/buses", {
        method: editingBusId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingBusId ? { id: editingBusId, ...newBus } : newBus),
      });

      if (res.ok) {
        toast.success(editingBusId ? "Bus updated successfully" : "Bus created successfully");
        setShowBusModal(false);
        setEditingBusId(null);
        setNewBus({ plateNumber: "", capacity: 20, status: "ACTIVE" });
        fetchBuses();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save bus");
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }"""
    content = re.sub(r'async function handleCreateBus[\s\S]*?\}\s*\}\s*catch[^\}]*\}', handle_create_bus_new, content)

    # 5. handleCreateRoute
    handle_create_route_new = """  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    const stops = newRoute.stopsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoute.name, stops }),
      });

      if (res.ok) {
        toast.success("Route created successfully");
        setShowRouteModal(false);
        setNewRoute({ name: "", stopsInput: "" });
        fetchRoutes();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create route");
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }"""
    content = re.sub(r'async function handleCreateRoute[\s\S]*?\}\s*\}\s*catch[^\}]*\}', handle_create_route_new, content)

    # 6. handleCreateTrip
    handle_create_trip_new = """  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...newTrip,
        driverId: newTrip.driverId || undefined,
        departureTime: newTrip.departureTime
          ? new Date(newTrip.departureTime).toISOString()
          : "",
        estimatedArrivalTime: newTrip.estimatedArrivalTime
          ? new Date(newTrip.estimatedArrivalTime).toISOString()
          : "",
      };

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Trip scheduled successfully");
        setShowTripModal(false);
        setNewTrip({
          routeId: "",
          busId: "",
          driverId: "",
          departureTime: "",
          estimatedArrivalTime: "",
        });
        fetchTrips();
      } else {
        const errData = await res.json();
        toast.error(`Failed to schedule trip: ${errData.error || res.status}`);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }"""
    content = re.sub(r'async function handleCreateTrip[\s\S]*?\}\s*\}\s*catch[^\}]*\}', handle_create_trip_new, content)

    # 7. handleReviewAppeal
    handle_review_appeal_new = """  async function handleReviewAppeal(
    appealId: string,
    status: "APPROVED" | "REJECTED"
  ) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/appeals/${appealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminComment }),
      });

      if (res.ok) {
        toast.success(`Appeal ${status.toLowerCase()} successfully`);
        setSelectedAppeal(null);
        setAdminComment("");
        fetchAppeals();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to process appeal");
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); } finally { setIsSubmitting(false); }
  }"""
    content = re.sub(r'async function handleReviewAppeal[\s\S]*?\}\s*\}\s*catch[^\}]*\}', handle_review_appeal_new, content)

    # Update BusesTab props
    content = content.replace(
        '<BusesTab buses={buses} onOpenModal={() => setShowBusModal(true)} />',
        '<BusesTab buses={buses} onOpenModal={() => { setEditingBusId(null); setNewBus({ plateNumber: "", capacity: 20, status: "ACTIVE" }); setShowBusModal(true); }} onEditBus={(bus) => { setEditingBusId(bus.id); setNewBus({ plateNumber: bus.plateNumber, capacity: bus.capacity, status: bus.status }); setShowBusModal(true); }} />'
    )

    # Update Modals UI
    content = content.replace(
        'Add New Bus to Fleet',
        '{editingBusId ? "Edit Bus" : "Add New Bus to Fleet"}'
    )
    content = content.replace(
        '<button\n                  type="submit"\n                  className="btn-primary flex-1"\n                >\n                  Create Bus\n                </button>',
        '<button\n                  type="submit"\n                  className="btn-primary flex-1"\n                  disabled={isSubmitting}\n                >\n                  {isSubmitting ? "Saving..." : editingBusId ? "Save Changes" : "Create Bus"}\n                </button>'
    )
    
    content = content.replace(
        '<button\n                  type="submit"\n                  className="btn-primary flex-1"\n                >\n                  Create Route\n                </button>',
        '<button\n                  type="submit"\n                  className="btn-primary flex-1"\n                  disabled={isSubmitting}\n                >\n                  {isSubmitting ? "Saving..." : "Create Route"}\n                </button>'
    )
    
    content = content.replace(
        '<button\n                  type="submit"\n                  className="btn-primary w-full"\n                >\n                  Schedule Trip\n                </button>',
        '<button\n                  type="submit"\n                  className="btn-primary w-full"\n                  disabled={isSubmitting}\n                >\n                  {isSubmitting ? "Saving..." : "Schedule Trip"}\n                </button>'
    )

    content = content.replace(
        '<button\n                      onClick={() =>\n                        handleReviewAppeal(selectedAppeal.id, "APPROVED")\n                      }\n                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors"\n                    >\n                      Approve & Restore Score\n                    </button>',
        '<button\n                      onClick={() =>\n                        handleReviewAppeal(selectedAppeal.id, "APPROVED")\n                      }\n                      disabled={isSubmitting}\n                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors"\n                    >\n                      Approve & Restore Score\n                    </button>'
    )
    content = content.replace(
        '<button\n                      onClick={() =>\n                        handleReviewAppeal(selectedAppeal.id, "REJECTED")\n                      }\n                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm transition-colors"\n                    >\n                      Reject Appeal\n                    </button>',
        '<button\n                      onClick={() =>\n                        handleReviewAppeal(selectedAppeal.id, "REJECTED")\n                      }\n                      disabled={isSubmitting}\n                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm transition-colors"\n                    >\n                      Reject Appeal\n                    </button>'
    )
    
    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Admin dashboard updated successfully!")

if __name__ == '__main__':
    main()
