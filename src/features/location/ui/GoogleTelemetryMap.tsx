"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

interface Coordinate {
  readonly latitude: number;
  readonly longitude: number;
}

interface StopCoordinate extends Coordinate {
  readonly name: string;
}

interface LatLngLiteral {
  lat: number;
  lng: number;
}

interface GoogleMapsApi {
  Map: new (
    element: HTMLElement,
    options: { center: LatLngLiteral; zoom: number; mapId: string; disableDefaultUI: boolean },
  ) => { fitBounds: (bounds: unknown, padding?: number) => void };
  LatLngBounds: new () => { extend: (point: LatLngLiteral) => void };
  Polyline: new (options: {
    map: unknown;
    path: LatLngLiteral[];
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
  }) => unknown;
  Marker: new (options: {
    map: unknown;
    position: LatLngLiteral;
    title: string;
    label?: string;
  }) => unknown;
}

function mapsApi(): GoogleMapsApi | null {
  const value = (window as unknown as { google?: { maps?: GoogleMapsApi } }).google;
  return value?.maps ?? null;
}

export default function GoogleTelemetryMap({
  apiKey,
  location,
  stops,
  busPlateNumber,
  onUnavailable,
}: {
  apiKey: string;
  location: Coordinate;
  stops: readonly StopCoordinate[];
  busPlateNumber: string;
  onUnavailable: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => mapsApi() !== null);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    try {
      const maps = mapsApi();
      if (!maps) throw new Error("Maps JavaScript API unavailable");
      const busPosition = { lat: location.latitude, lng: location.longitude };
      const map = new maps.Map(containerRef.current, {
        center: busPosition,
        zoom: 14,
        mapId: "DEMO_MAP_ID",
        disableDefaultUI: true,
      });
      const bounds = new maps.LatLngBounds();
      const path = stops.map((stop) => ({ lat: stop.latitude, lng: stop.longitude }));
      for (const [index, stop] of stops.entries()) {
        const position = path[index]!;
        bounds.extend(position);
        new maps.Marker({ map, position, title: stop.name, label: String(index + 1) });
      }
      bounds.extend(busPosition);
      new maps.Marker({ map, position: busPosition, title: `Shuttle ${busPlateNumber}` });
      if (path.length >= 2) {
        new maps.Polyline({
          map,
          path,
          strokeColor: "#74A9F5",
          strokeOpacity: 0.9,
          strokeWeight: 4,
        });
      }
      map.fitBounds(bounds, 48);
    } catch {
      onUnavailable();
    }
  }, [busPlateNumber, location, onUnavailable, ready, stops]);

  return (
    <>
      <Script
        id="google-maps-browser"
        src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&auth_referrer_policy=origin`}
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={onUnavailable}
      />
      <div ref={containerRef} className="telemetry-map" aria-label="Geographic shuttle map" />
    </>
  );
}
