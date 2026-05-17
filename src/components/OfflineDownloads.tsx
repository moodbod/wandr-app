"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Download,
  Trash2,
  Search,
  Globe,
  MapPin,
  Check,
  ChevronDown,
  ChevronRight,
  Wifi,
  Database,
  Info,
  Layers,
  Settings,
  CircleAlert,
  Loader2,
  X,
  Plus
} from "lucide-react";

// Types for offline geocoding search results
interface GlobalSearchResult {
  id: string;
  name: string;
  fullName: string;
  type: "country" | "region" | "city";
  sizeMb: number;
  flag?: string;
  center?: [number, number];
  bbox?: [number, number, number, number] | null;
}

interface ActiveDownload {
  id: string;
  name: string;
  type: "country" | "region" | "city";
  progress: number;
  speed: string;
  sizeMb: number;
}

// Local Seed / Fallback data matching hierarchy for instant offline results
const hierarchyData = [
  {
    id: "italy",
    name: "Italy",
    flag: "🇮🇹",
    sizeMb: 320,
    regions: [
      {
        id: "tuscany",
        name: "Tuscany",
        sizeMb: 85,
        cities: [
          { id: "florence", name: "Florence", sizeMb: 22, spotsCount: 18, walksCount: 2 },
          { id: "siena", name: "Siena", sizeMb: 12, spotsCount: 9, walksCount: 1 },
          { id: "pisa", name: "Pisa", sizeMb: 8, spotsCount: 6, walksCount: 1 },
        ],
      },
      {
        id: "lombardy",
        name: "Lombardy",
        sizeMb: 62,
        cities: [
          { id: "milan", name: "Milan", sizeMb: 28, spotsCount: 22, walksCount: 3 },
          { id: "como", name: "Lake Como", sizeMb: 14, spotsCount: 11, walksCount: 2 },
        ],
      },
    ],
  },
  {
    id: "japan",
    name: "Japan",
    flag: "🇯🇵",
    sizeMb: 450,
    regions: [
      {
        id: "kanto",
        name: "Kanto",
        sizeMb: 120,
        cities: [
          { id: "tokyo", name: "Tokyo", sizeMb: 35, spotsCount: 42, walksCount: 5 },
          { id: "yokohama", name: "Yokohama", sizeMb: 18, spotsCount: 14, walksCount: 2 },
        ],
      },
      {
        id: "kansai",
        name: "Kansai",
        sizeMb: 95,
        cities: [
          { id: "kyoto", name: "Kyoto", sizeMb: 18, spotsCount: 28, walksCount: 4 },
          { id: "osaka", name: "Osaka", sizeMb: 22, spotsCount: 24, walksCount: 2 },
          { id: "nara", name: "Nara", sizeMb: 10, spotsCount: 12, walksCount: 1 },
        ],
      },
    ],
  },
  {
    id: "france",
    name: "France",
    flag: "🇫🇷",
    sizeMb: 280,
    regions: [
      {
        id: "ile-de-france",
        name: "Île-de-France",
        sizeMb: 75,
        cities: [
          { id: "paris", name: "Paris", sizeMb: 32, spotsCount: 45, walksCount: 6 },
          { id: "versailles", name: "Versailles", sizeMb: 12, spotsCount: 8, walksCount: 1 },
        ],
      },
      {
        id: "provence",
        name: "Provence",
        sizeMb: 58,
        cities: [
          { id: "nice", name: "Nice", sizeMb: 14, spotsCount: 16, walksCount: 2 },
          { id: "marseille", name: "Marseille", sizeMb: 15, spotsCount: 12, walksCount: 1 },
        ],
      },
    ],
  },
  {
    id: "united-states",
    name: "United States",
    flag: "🇺🇸",
    sizeMb: 520,
    regions: [
      {
        id: "california",
        name: "California",
        sizeMb: 140,
        cities: [
          { id: "san-francisco", name: "San Francisco", sizeMb: 25, spotsCount: 30, walksCount: 4 },
          { id: "los-angeles", name: "Los Angeles", sizeMb: 28, spotsCount: 26, walksCount: 2 },
        ],
      },
      {
        id: "new-york",
        name: "New York",
        sizeMb: 95,
        cities: [
          { id: "new-york-city", name: "New York City", sizeMb: 38, spotsCount: 50, walksCount: 8 },
        ],
      },
    ],
  },
];

// Helper to convert ISO country code to flag emoji
function getFlagEmoji(countryCode: string) {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function OfflineDownloads() {
  // App States
  const [downloaded, setDownloaded] = useState<Record<string, { name: string; type: string; sizeMb: number; flag?: string }>>({});
  const [downloading, setDownloading] = useState<Record<string, ActiveDownload>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Preference Toggles
  const [wifiOnly, setWifiOnly] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [hdImages, setHdImages] = useState(false);

  // Expanded Collapsible Countries/Regions in Browsing hierarchy
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({ italy: true });
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});

  // Device Storage Constants (Simulated)
  const totalCapacityGb = 64;
  const otherAppsGb = 48.2;

  // Trigger Toast helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Calculate downloaded guides total size (MB)
  const wandrStorageMb = useMemo(() => {
    return Object.values(downloaded).reduce((sum, item) => sum + item.sizeMb, 0);
  }, [downloaded]);

  const wandrStorageGb = parseFloat((wandrStorageMb / 1024).toFixed(2));
  const freeSpaceGb = parseFloat((totalCapacityGb - otherAppsGb - wandrStorageGb).toFixed(2));
  
  // Percentage widths for Storage bar
  const otherAppsPct = (otherAppsGb / totalCapacityGb) * 100;
  const wandrStoragePct = (wandrStorageGb / totalCapacityGb) * 100;
  const freeSpacePct = Math.max(0, 100 - otherAppsPct - wandrStoragePct);

  // Mapbox Geocoding Autocomplete Search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      const query = searchQuery.trim();

      // If token is missing, perform high-fidelity local search fallback
      if (!token) {
        const localResults = performLocalSearch(query);
        setSearchResults(localResults);
        setIsSearching(false);
        return;
      }

      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&types=country,region,place&limit=8`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.features) {
          const results = data.features.map((feature: any): GlobalSearchResult => {
            const placeType = feature.place_type[0]; // 'country', 'region', 'place'
            const type = placeType === "place" ? "city" : (placeType as "country" | "region");
            
            // Deduce size estimation based on type
            const sizeMb = type === "country"
              ? Math.round(240 + (feature.text.charCodeAt(0) % 20) * 10)
              : type === "region"
              ? Math.round(55 + (feature.text.charCodeAt(0) % 15) * 4)
              : Math.round(15 + (feature.text.charCodeAt(0) % 10) * 2);

            let flag = "🏙️";
            if (type === "country") {
              flag = "🌍";
              const shortCode = feature.properties?.short_code;
              if (shortCode && shortCode.length === 2) {
                flag = getFlagEmoji(shortCode);
              }
            } else if (type === "region") {
              flag = "🗺️";
            }

            return {
              id: feature.id,
              name: feature.text,
              fullName: feature.place_name,
              type,
              sizeMb,
              flag,
              center: feature.center,
              bbox: feature.bbox || null
            };
          });
          setSearchResults(results);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error("Global geocoding lookup failed", err);
        setSearchResults(performLocalSearch(query));
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Search fallback using our local database seed
  const performLocalSearch = (query: string): GlobalSearchResult[] => {
    const q = query.toLowerCase();
    const results: GlobalSearchResult[] = [];

    hierarchyData.forEach((country) => {
      if (country.name.toLowerCase().includes(q)) {
        results.push({
          id: country.id,
          name: country.name,
          fullName: `${country.name} (Country package)`,
          type: "country",
          sizeMb: country.sizeMb,
          flag: country.flag,
        });
      }
      country.regions.forEach((region) => {
        if (region.name.toLowerCase().includes(q)) {
          results.push({
            id: region.id,
            name: region.name,
            fullName: `${region.name}, ${country.name}`,
            type: "region",
            sizeMb: region.sizeMb,
            flag: "🗺️",
          });
        }
        region.cities.forEach((city) => {
          if (city.name.toLowerCase().includes(q)) {
            results.push({
              id: city.id,
              name: city.name,
              fullName: `${city.name}, ${region.name}, ${country.name}`,
              type: "city",
              sizeMb: city.sizeMb,
              flag: "🏙️",
            });
          }
        });
      });
    });

    return results;
  };

  // Simulated download loop
  useEffect(() => {
    const activeIds = Object.keys(downloading);
    if (activeIds.length === 0) return;

    const interval = setInterval(() => {
      setDownloading((current) => {
        const next = { ...current };
        let updated = false;

        for (const id of Object.keys(next)) {
          const item = next[id];
          if (item.progress >= 100) {
            delete next[id];
            setDownloaded((prev) => ({
              ...prev,
              [id]: {
                name: item.name,
                type: item.type,
                sizeMb: item.sizeMb,
                flag: item.type === "country" ? "🌍" : item.type === "region" ? "🗺️" : "🏙️"
              }
            }));
            setTimeout(() => {
              triggerToast(`Downloaded ${item.name} offline package.`);
            }, 50);
            updated = true;
          } else {
            const increment = Math.floor(Math.random() * 15) + 6;
            const newProgress = Math.min(100, item.progress + increment);
            const speed = `${(Math.random() * 2 + 1.8).toFixed(1)} MB/s`;
            next[id] = {
              ...item,
              progress: newProgress,
              speed,
            };
            updated = true;
          }
        }

        return updated ? next : current;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [downloading]);

  // Add search suggestion to download queue
  const handleAddDownload = (item: GlobalSearchResult) => {
    if (downloaded[item.id] || downloading[item.id]) return;

    triggerToast(`Downloading ${item.name} guide.`);
    setDownloading((prev) => ({
      ...prev,
      [item.id]: {
        id: item.id,
        name: item.fullName.split(",")[0], // Compact name
        type: item.type,
        progress: 0,
        speed: "0.0 MB/s",
        sizeMb: item.sizeMb
      }
    }));
  };

  // Add item from hierarchy
  const handleAddHierarchyDownload = (id: string, name: string, type: "country" | "region" | "city", sizeMb: number) => {
    if (downloaded[id] || downloading[id]) return;

    triggerToast(`Downloading ${name} guide.`);
    setDownloading((prev) => ({
      ...prev,
      [id]: {
        id,
        name,
        type,
        progress: 0,
        speed: "0.0 MB/s",
        sizeMb
      }
    }));
  };

  // Delete downloaded package
  const handleDeletePackage = (id: string, name: string) => {
    setDownloaded((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    triggerToast(`Deleted ${name} offline package.`);
  };

  return (
    <div className="flex flex-col gap-6 font-sans antialiased text-black">
      {/* Sleek micro Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 bg-black px-4 py-3 text-xs font-medium text-white shadow-xl rounded-none animate-in fade-in slide-in-from-bottom-4">
          <Check className="size-3.5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Offline Maps Dashboard Card */}
      <section className="rounded-2xl border border-[#efefef] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5">
          
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-xl font-bold tracking-tight text-black">
                Offline maps & guides
              </h3>
              <p className="mt-1 text-sm text-[#5e5e5e] leading-relaxed">
                Search and download vector tiles, custom walks, and spot databases for cellular-free navigation.
              </p>
            </div>
            <button
              onClick={() => setShowSelector(true)}
              className="inline-flex h-10 items-center justify-center bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-black/90 active:bg-black/80 rounded-full"
            >
              Add guide
            </button>
          </div>

          {/* iOS-Style Flat Segmented Storage Bar */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#efefef]">
            <div className="flex items-center justify-between text-xs font-medium text-[#5e5e5e]">
              <span>Storage status</span>
              <span className="font-semibold text-black">{freeSpaceGb} GB free</span>
            </div>

            {/* Storage Bar */}
            <div className="flex h-3 w-full bg-[#efefef] rounded-full overflow-hidden">
              {/* Other App Data */}
              <div
                style={{ width: `${otherAppsPct}%` }}
                className="h-full bg-[#afafaf]"
                title={`Other App Data: ${otherAppsGb} GB`}
              />
              {/* Wandr Offline guides */}
              {wandrStorageMb > 0 && (
                <div
                  style={{ width: `${wandrStoragePct}%` }}
                  className="h-full bg-black"
                  title={`Wandr Offline Guides: ${wandrStorageMb} MB`}
                />
              )}
            </div>

            {/* Legend Labels */}
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[#5e5e5e] font-medium">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#afafaf]" />
                <span>Other apps ({otherAppsGb} GB)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-black" />
                <span className="text-black">Wandr offline guides ({wandrStorageMb} MB)</span>
              </div>
            </div>
          </div>

          {/* Active Download Progress Section */}
          {Object.keys(downloading).length > 0 && (
            <div className="flex flex-col gap-3.5 bg-[#f3f3f3] p-4 rounded-xl border border-[#efefef]">
              <div className="text-xs font-bold uppercase tracking-wider text-[#5e5e5e]">
                Active downloads
              </div>
              {Object.values(downloading).map((item) => (
                <div key={item.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="truncate">{item.name}</span>
                    <span className="text-xs text-[#5e5e5e]">
                      {item.speed} • {item.progress}%
                    </span>
                  </div>
                  {/* Progress Line */}
                  <div className="h-1.5 w-full bg-[#efefef] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${item.progress}%` }}
                      className="h-full bg-black transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Downloaded Guides List */}
          {Object.keys(downloaded).length > 0 ? (
            <div className="flex flex-col gap-2 pt-2 border-t border-[#efefef]">
              <div className="text-xs font-bold uppercase tracking-wider text-[#5e5e5e] mb-1">
                Offline guides ({Object.keys(downloaded).length})
              </div>
              <div className="divide-y divide-[#efefef]">
                {Object.entries(downloaded).map(([id, guide]) => (
                  <div key={id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl shrink-0" aria-hidden>
                        {guide.flag || "🏙️"}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-black">{guide.name}</span>
                          <span className="shrink-0 text-[10px] font-semibold text-[#5e5e5e] bg-[#efefef] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Ready
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[#5e5e5e]">
                          <span className="capitalize">{guide.type} guide</span>
                          <span>•</span>
                          <span>{guide.sizeMb} MB</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePackage(id, guide.name)}
                      className="grid size-8 place-items-center rounded-full text-[#5e5e5e] hover:bg-[#efefef] hover:text-black transition-all"
                      aria-label={`Delete ${guide.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#afafaf] p-6 text-center">
              <Globe className="mx-auto size-6 text-[#5e5e5e]" />
              <div className="mt-2 text-sm font-bold text-black">No offline guides saved</div>
              <p className="mt-1 text-xs text-[#5e5e5e] leading-relaxed max-w-sm mx-auto">
                No guides are stored on this device yet. Tap &apos;Add guide&apos; to search and store countries, regions, or cities.
              </p>
            </div>
          )}

        </div>
      </section>

      {/* Sleek Minimal Configuration Preferences */}
      <section className="rounded-2xl border border-[#efefef] bg-white p-6 shadow-sm">
        <h4 className="text-sm font-bold text-black uppercase tracking-wider mb-4">
          Preferences
        </h4>
        <div className="flex flex-col gap-4">
          
          {/* Wi-Fi Preferences */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-black">
                <Wifi className="size-4 text-black" />
                Only download over Wi-Fi
              </div>
              <p className="mt-1 text-xs text-[#5e5e5e] leading-relaxed max-w-sm">
                Restricts map and media synchronization to Wi-Fi connections to prevent cellular billing.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={wifiOnly}
                onChange={(e) => setWifiOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-[#efefef] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          {/* Sync Preferences */}
          <div className="flex items-start justify-between gap-4 border-t border-[#efefef] pt-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-black">
                <Database className="size-4 text-black" />
                Auto-update offline packages
              </div>
              <p className="mt-1 text-xs text-[#5e5e5e] leading-relaxed max-w-sm">
                Allows Wandr to automatically fetch spot changes, descriptions, and route details in the background.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoUpdate}
                onChange={(e) => setAutoUpdate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-[#efefef] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          {/* Media Preferences */}
          <div className="flex items-start justify-between gap-4 border-t border-[#efefef] pt-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-black">
                <Layers className="size-4 text-black" />
                Cache high-resolution photographs
              </div>
              <p className="mt-1 text-xs text-[#5e5e5e] leading-relaxed max-w-sm">
                Saves high-density spot galleries and details offline. Increases package storage requirements by roughly 2x.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hdImages}
                onChange={(e) => setHdImages(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-[#efefef] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

        </div>
      </section>

      {/* Slide-over Global Search & Selector Overlay */}
      {showSelector && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 transition-all duration-300 animate-in fade-in">
          {/* Backdrop Closer */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setShowSelector(false)} />

          {/* Slide-over Container */}
          <div className="relative flex h-full w-full max-w-lg flex-col bg-white px-5 py-6 shadow-2xl animate-in slide-in-from-right duration-300 sm:px-6">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#efefef]">
              <div>
                <h3 className="text-lg font-bold text-black">
                  Select offline guide
                </h3>
                <p className="text-xs text-[#5e5e5e] mt-1">
                  Search globally for any country, region, or city in the world to download.
                </p>
              </div>
              <button
                onClick={() => setShowSelector(false)}
                className="grid size-9 place-items-center rounded-full hover:bg-[#efefef] text-[#5e5e5e] hover:text-black transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Smart Universal Geocoding Input */}
            <div className="my-4 relative">
              <Search className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-[#5e5e5e]" />
              <input
                type="text"
                placeholder="Search globally (e.g. Paris, Tuscany, Kyoto...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 w-full bg-[#efefef] pl-11 pr-4 text-sm text-black placeholder-[#afafaf] outline-none rounded-none focus:ring-2 focus:ring-black transition-all"
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <Loader2 className="size-4.5 text-black animate-spin" />
                </div>
              )}
            </div>

            {/* Dynamic Results vs Browsing Hierarchy */}
            <div className="flex-1 overflow-y-auto pr-1">
              
              {searchQuery.trim().length >= 2 ? (
                // 1. Dynamic Geocoding suggestions from around the world
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5e5e5e] mb-2 px-1">
                    Search results
                  </div>
                  {searchResults.length > 0 ? (
                    searchResults.map((item) => {
                      const isItemDownloaded = !!downloaded[item.id];
                      const isItemDownloading = !!downloading[item.id];

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 p-3 border border-[#efefef] bg-white hover:bg-[#f3f3f3] transition-all"
                        >
                          <div className="min-w-0 flex items-start gap-2.5">
                            <span className="text-xl mt-0.5 shrink-0" aria-hidden>
                              {item.flag || (item.type === "region" ? "🗺️" : "🏙️")}
                            </span>
                            <div className="min-w-0">
                              <span className="block text-sm font-bold text-black truncate leading-tight">
                                {item.name}
                              </span>
                              <span className="block text-xs text-[#5e5e5e] truncate mt-0.5">
                                {item.fullName}
                              </span>
                              <span className="inline-block text-[9px] font-semibold text-[#5e5e5e] uppercase tracking-wide bg-[#efefef] px-1.5 py-0.5 mt-1.5 capitalize">
                                {item.type} Guide
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-semibold text-[#5e5e5e]">
                              {item.sizeMb} MB
                            </span>
                            {isItemDownloaded ? (
                              <span className="flex size-8 items-center justify-center bg-black text-white rounded-full">
                                <Check className="size-4" />
                              </span>
                            ) : isItemDownloading ? (
                              <span className="flex size-8 items-center justify-center bg-[#efefef] text-black rounded-full">
                                <Loader2 className="size-4 animate-spin" />
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddDownload(item)}
                                className="flex size-8 items-center justify-center bg-black text-white hover:bg-black/90 rounded-full transition-transform active:scale-90"
                                title="Download package"
                              >
                                <Plus className="size-4.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    !isSearching && (
                      <div className="text-center py-10 border border-dashed border-[#afafaf]">
                        <CircleAlert className="mx-auto size-6 text-[#5e5e5e]" />
                        <div className="mt-2 text-sm font-bold text-black">No matches found</div>
                        <p className="text-xs text-[#5e5e5e] mt-1 max-w-xs mx-auto px-4 leading-relaxed">
                          Try adjusting spelling or searching for standard countries, regions, or major cities.
                        </p>
                      </div>
                    )
                  )}
                </div>
              ) : (
                // 2. Default Browsing Hierarchy (Compact & Structured)
                <div className="space-y-4">
                  
                  {/* Visual Hint Card */}
                  <div className="bg-[#f3f3f3] border border-[#efefef] p-4 rounded-none flex gap-3 text-xs text-[#5e5e5e]">
                    <Info className="size-4 text-black shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <span className="font-bold text-black">Global Search enabled:</span> Search for <span className="font-bold text-black">any</span> place in the world above, or browse curated destinations below.
                    </p>
                  </div>

                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5e5e5e] mb-1 px-1">
                    Curated destinations
                  </div>

                  <div className="space-y-3">
                    {hierarchyData.map((country) => {
                      const isCountryDownloaded = !!downloaded[country.id];
                      const isCountryDownloading = !!downloading[country.id];
                      const countryExpanded = expandedCountries[country.id];

                      return (
                        <div
                          key={country.id}
                          className={`border p-4 transition-all rounded-xl ${
                            isCountryDownloaded
                              ? "border-black bg-black/[0.01]"
                              : "border-[#efefef] hover:border-[#afafaf]"
                          }`}
                        >
                          {/* Country Row */}
                          <div className="flex items-center justify-between gap-3">
                            <button
                              onClick={() => setExpandedCountries((prev) => ({ ...prev, [country.id]: !prev[country.id] }))}
                              className="flex flex-1 items-center gap-2.5 text-left font-bold text-sm min-w-0"
                            >
                              <span className="text-xl shrink-0" aria-hidden>
                                {country.flag}
                              </span>
                              <span className="truncate leading-tight">{country.name}</span>
                              <span className="text-[10px] font-semibold text-[#5e5e5e] uppercase tracking-wide bg-[#efefef] px-1.5 py-0.5 rounded-full shrink-0">
                                Country
                              </span>
                              {countryExpanded ? (
                                <ChevronDown className="size-4 text-[#5e5e5e] shrink-0" />
                              ) : (
                                <ChevronRight className="size-4 text-[#5e5e5e] shrink-0" />
                              )}
                            </button>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="text-xs font-semibold text-[#5e5e5e]">
                                {country.sizeMb} MB
                              </span>
                              {isCountryDownloaded ? (
                                <span className="flex size-7 items-center justify-center bg-black text-white rounded-full">
                                  <Check className="size-3.5" />
                                </span>
                              ) : isCountryDownloading ? (
                                <span className="flex size-7 items-center justify-center bg-[#efefef] text-black rounded-full">
                                  <Loader2 className="size-3.5 animate-spin" />
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAddHierarchyDownload(country.id, country.name, "country", country.sizeMb)}
                                  className="flex size-7 items-center justify-center bg-black text-white hover:bg-black/90 rounded-full transition-all active:scale-90"
                                  title="Download country"
                                >
                                  <Download className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Country Details (Regions) */}
                          {countryExpanded && country.regions.length > 0 && (
                            <div className="mt-4 pl-3.5 border-l border-[#efefef] space-y-3.5">
                              {country.regions.map((region) => {
                                const isRegionDownloaded = isCountryDownloaded || !!downloaded[region.id];
                                const isRegionDownloading = !!downloading[region.id];
                                const regionExpanded = expandedRegions[region.id];

                                return (
                                  <div key={region.id} className="space-y-2">
                                    {/* Region Row */}
                                    <div className="flex items-center justify-between gap-3">
                                      <button
                                        onClick={() => setExpandedRegions((prev) => ({ ...prev, [region.id]: !prev[region.id] }))}
                                        className="flex flex-1 items-center gap-2 text-left font-bold text-xs text-black/90 min-w-0"
                                      >
                                        <Globe className="size-3.5 text-[#5e5e5e] shrink-0" />
                                        <span className="truncate">{region.name}</span>
                                        <span className="text-[9px] font-semibold text-[#5e5e5e] uppercase tracking-wide bg-[#efefef] px-1 rounded-full shrink-0">
                                          Region
                                        </span>
                                        {regionExpanded ? (
                                          <ChevronDown className="size-3 text-[#5e5e5e] shrink-0" />
                                        ) : (
                                          <ChevronRight className="size-3 text-[#5e5e5e] shrink-0" />
                                        )}
                                      </button>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-semibold text-[#5e5e5e]">
                                          {region.sizeMb} MB
                                        </span>
                                        {isRegionDownloaded ? (
                                          <span className="flex size-6 items-center justify-center bg-black text-white rounded-full opacity-60">
                                            <Check className="size-3" />
                                          </span>
                                        ) : isRegionDownloading ? (
                                          <span className="flex size-6 items-center justify-center bg-[#efefef] text-black rounded-full">
                                            <Loader2 className="size-3 animate-spin" />
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => handleAddHierarchyDownload(region.id, region.name, "region", region.sizeMb)}
                                            className="flex size-6 items-center justify-center bg-[#efefef] text-black hover:bg-[#e2e2e2] rounded-full transition-all active:scale-90"
                                            title="Download region"
                                          >
                                            <Download className="size-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Cities under Region */}
                                    {regionExpanded && region.cities.length > 0 && (
                                      <div className="pl-4 border-l border-[#efefef] space-y-2 mt-2">
                                        {region.cities.map((city) => {
                                          const isCityDownloaded = isRegionDownloaded || !!downloaded[city.id];
                                          const isCityDownloading = !!downloading[city.id];

                                          return (
                                            <div key={city.id} className="flex items-center justify-between gap-3 py-1">
                                              <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-black/80">
                                                  <MapPin className="size-3.5 text-[#5e5e5e] shrink-0" />
                                                  <span className="truncate">{city.name}</span>
                                                </div>
                                                <div className="mt-0.5 text-[10px] text-[#5e5e5e] font-medium pl-5">
                                                  {city.spotsCount} spots • {city.walksCount} walks
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[10px] font-semibold text-[#5e5e5e]">
                                                  {city.sizeMb} MB
                                                </span>
                                                {isCityDownloaded ? (
                                                  <span className="flex size-5.5 items-center justify-center bg-black text-white rounded-full opacity-60">
                                                    <Check className="size-2.5" />
                                                  </span>
                                                ) : isCityDownloading ? (
                                                  <span className="flex size-5.5 items-center justify-center bg-[#efefef] text-black rounded-full">
                                                    <Loader2 className="size-2.5 animate-spin" />
                                                  </span>
                                                ) : (
                                                  <button
                                                    onClick={() => handleAddHierarchyDownload(city.id, city.name, "city", city.sizeMb)}
                                                    className="flex size-5.5 items-center justify-center bg-[#efefef] text-black hover:bg-[#e2e2e2] rounded-full transition-all active:scale-90"
                                                    title="Download city guide"
                                                  >
                                                    <Download className="size-2.5" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Slide-over Footer */}
            <div className="pt-4 border-t border-[#efefef] mt-4 flex items-center justify-between text-xs text-[#5e5e5e]">
              <span>Background downloading active</span>
              <button
                onClick={() => setShowSelector(false)}
                className="inline-flex h-10 items-center justify-center bg-black px-6 text-xs font-semibold text-white transition-colors hover:bg-black/90 active:bg-black/80 rounded-full"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
