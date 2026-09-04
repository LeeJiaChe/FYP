"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

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

interface GoogleMap {
  fitBounds: (bounds: unknown, padding?: number) => void;
}

interface AdvancedMarker {
  map: GoogleMap | null;
  position: LatLngLiteral | null;
}

interface GoogleMapsApi {
  Map: new (
    element: HTMLElement,
    options: {
      center: LatLngLiteral;
      zoom: number;
      mapId: string;
      disableDefaultUI: boolean;
    },
  ) => GoogleMap;
  LatLngBounds: new () => { extend: (point: LatLngLiteral) => void };
  Polyline: new (options: {
    map: GoogleMap;
    path: LatLngLiteral[];
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
  }) => { setMap: (map: GoogleMap | null) => void };
  marker: {
    AdvancedMarkerElement: new (options: {
      map: GoogleMap;
      position: LatLngLiteral;
      title: string;
      content?: HTMLElement;
    }) => AdvancedMarker;
  };
}

function mapsApi(): GoogleMapsApi | null {
  const value = (window as unknown as { google?: { maps?: GoogleMapsApi } }).google;
  return value?.maps?.marker ? value.maps : null;
}

function markerLabel(label: string, kind: "stop" | "shuttle") {
  const element = document.createElement("div");
  element.textContent = label;
  element.className = `map-marker map-marker-${kind}`;
  return element;
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
  const mapRef = useRef<GoogleMap | null>(null);
  const initialLocationRef = useRef(location);
  const shuttleMarkerRef = useRef<AdvancedMarker | null>(null);
  const stopMarkersRef = useRef<AdvancedMarker[]>([]);
  const polylineRef = useRef<{ setMap: (map: GoogleMap | null) => void } | null>(null);
  const [ready, setReady] = useState(() => mapsApi() !== null);
  const topologyKey = useMemo(
    () =>
      stops
        .map((stop) => `${stop.name}:${stop.latitude}:${stop.longitude}`)
        .join("|"),
    [stops],
  );

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    try {
      const maps = mapsApi();
      if (!maps) throw new Error("Maps JavaScript API unavailable");
      const initialLocation = initialLocationRef.current;
      mapRef.current = new maps.Map(containerRef.current, {
        center: { lat: initialLocation.latitude, lng: initialLocation.longitude },
        zoom: 14,
        mapId: "DEMO_MAP_ID",
        disableDefaultUI: true,
      });
    } catch {
      onUnavailable();
    }
  }, [onUnavailable, ready]);

  useEffect(() => {
    const maps = mapsApi();
    const map = mapRef.current;
    if (!ready || !maps || !map) return;

    stopMarkersRef.current.forEach((marker) => {
      marker.map = null;
    });
    polylineRef.current?.setMap(null);

    const path = stops.map((stop) => ({
      lat: stop.latitude,
      lng: stop.longitude,
    }));
    stopMarkersRef.current = stops.map(
      (stop, index) =>
        new maps.marker.AdvancedMarkerElement({
          map,
          position: path[index]!,
          title: stop.name,
          content: markerLabel(String(index + 1), "stop"),
        }),
    );
    polylineRef.current =
      path.length >= 2
        ? new maps.Polyline({
            map,
            path,
            strokeColor: "#74A9F5",
            strokeOpacity: 0.9,
            strokeWeight: 4,
          })
        : null;

    const bounds = new maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    const initialLocation = initialLocationRef.current;
    bounds.extend({
      lat: initialLocation.latitude,
      lng: initialLocation.longitude,
    });
    map.fitBounds(bounds, 48);
  }, [ready, stops, topologyKey]);

  useEffect(() => {
    const maps = mapsApi();
    const map = mapRef.current;
    if (!ready || !maps || !map) return;
    const position = { lat: location.latitude, lng: location.longitude };
    if (!shuttleMarkerRef.current) {
      shuttleMarkerRef.current = new maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: `Shuttle ${busPlateNumber}`,
        content: markerLabel("BUS", "shuttle"),
      });
      return;
    }
    shuttleMarkerRef.current.position = position;
  }, [busPlateNumber, location.latitude, location.longitude, ready]);

  useEffect(
    () => () => {
      stopMarkersRef.current.forEach((marker) => {
        marker.map = null;
      });
      if (shuttleMarkerRef.current) shuttleMarkerRef.current.map = null;
      polylineRef.current?.setMap(null);
    },
    [],
  );

  return (
    <>
      <Script
        id="google-maps-browser"
        src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=marker&auth_referrer_policy=origin`}
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={onUnavailable}
      />
      <div ref={containerRef} className="telemetry-map" aria-label="Geographic shuttle map" />
    </>
  );
}
