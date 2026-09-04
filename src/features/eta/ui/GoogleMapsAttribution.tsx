import type { EtaSource } from "../contracts/eta.schemas";

export function GoogleMapsAttribution({ source }: { readonly source: EtaSource }) {
  if (source !== "TRAFFIC_AWARE") return null;

  return (
    <span
      aria-label="Google Maps"
      className="whitespace-nowrap font-sans text-xs font-normal tracking-normal text-[#5e5e5e] dark:text-white"
      translate="no"
    >
      Google Maps
    </span>
  );
}
