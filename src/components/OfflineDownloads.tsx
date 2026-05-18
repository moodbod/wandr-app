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
  Layers,
  CircleAlert,
  Loader2,
  X,
  Plus,
  Map as MapIcon,
  Building2
} from "lucide-react";

// Types for offline geocoding search results
interface GlobalSearchResult {
  id: string;
  name: string;
  fullName: string;
  type: "country" | "region" | "city";
  sizeMb: number;
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

const getTypeIcon = (type: string, className = "size-5") => {
  switch (type) {
    case "country":
      return <Globe className={className} />;
    case "region":
      return <MapIcon className={className} />;
    case "city":
    default:
      return <Building2 className={className} />;
  }
};

export function OfflineDownloads() {
  // App States
  const [downloaded, setDownloaded] = useState<Record<string, { name: string; type: string; sizeMb: number }>>({});
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

            return {
              id: feature.id,
              name: feature.text,
              fullName: feature.place_name,
              type,
              sizeMb,
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
    <div className="flex flex-col gap-10 font-sans antialiased text-black pb-8">
      {/* Sleek micro Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 bg-black px-6 py-3 text-[14px] font-bold text-white shadow-xl rounded-full animate-in fade-in slide-in-from-bottom-4">
          <Check className="size-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Offline Maps List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            <p className="text-[16px] text-[#5e5e5e] leading-relaxed max-w-sm">
              Search and download vector tiles, custom walks, and spot databases for cellular-free navigation.
            </p>
          </div>
          <button
            onClick={() => setShowSelector(true)}
            className="inline-flex min-h-[48px] items-center justify-center bg-black px-6 text-[16px] font-bold text-white transition-colors hover:bg-black/90 active:bg-black/80 rounded-full shrink-0"
          >
            Add guide
          </button>
        </div>

        {/* Storage Bar */}
        <div className="flex flex-col gap-3 py-4 border-t border-[#efefef]">
          <div className="flex items-center justify-between text-[14px] font-bold text-[#5e5e5e]">
            <span>Storage status</span>
            <span className="text-black">{freeSpaceGb} GB free</span>
          </div>
          <div className="flex h-4 w-full bg-[#f3f3f3] rounded-full overflow-hidden">
            <div
              style={{ width: `${otherAppsPct}%` }}
              className="h-full bg-[#afafaf]"
              title={`Other App Data: ${otherAppsGb} GB`}
            />
            {wandrStorageMb > 0 && (
              <div
                style={{ width: `${wandrStoragePct}%` }}
                className="h-full bg-black"
                title={`Wandr Offline Guides: ${wandrStorageMb} MB`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-[#5e5e5e] font-medium">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#afafaf]" />
              <span>Other apps ({otherAppsGb} GB)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-black" />
              <span className="text-black">Wandr offline guides ({wandrStorageMb} MB)</span>
            </div>
          </div>
        </div>

        {/* Active Download Progress Section */}
        {Object.keys(downloading).length > 0 && (
          <div className="flex flex-col gap-4 bg-[#f3f3f3] p-6 rounded-[16px] border border-[#efefef]">
            <div className="text-[14px] font-bold text-[#5e5e5e]">
              Active downloads
            </div>
            {Object.values(downloading).map((item) => (
              <div key={item.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[14px] font-bold text-black">
                  <span className="truncate">{item.name}</span>
                  <span className="text-[14px] text-[#5e5e5e]">
                    {item.speed} • {item.progress}%
                  </span>
                </div>
                <div className="h-2 w-full bg-white rounded-full overflow-hidden">
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
          <div className="flex flex-col gap-2">
            <div className="text-[20px] font-bold tracking-tight text-black mt-4 mb-2">
              Saved guides
            </div>
            <div className="divide-y divide-[#efefef]">
              {Object.entries(downloaded).map(([id, guide]) => (
                <div key={id} className="flex min-h-[72px] items-center justify-between py-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="grid size-[40px] shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-black">
                      {getTypeIcon(guide.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[16px] font-bold text-black">{guide.name}</span>
                        <span className="shrink-0 text-[11px] font-bold text-black bg-[#f3f3f3] px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Ready
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[14px] text-[#5e5e5e]">
                        <span className="capitalize">{guide.type}</span>
                        <span>•</span>
                        <span>{guide.sizeMb} MB</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePackage(id, guide.name)}
                    className="grid size-10 place-items-center rounded-full text-[#5e5e5e] hover:bg-[#f3f3f3] hover:text-black transition-all"
                    aria-label={`Delete ${guide.name}`}
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[16px] bg-[#f3f3f3] p-8 text-center mt-4 flex flex-col items-center">
            <div className="grid size-[64px] place-items-center rounded-full bg-white mb-4">
              <Globe className="size-8 text-[#afafaf]" />
            </div>
            <div className="text-[20px] font-bold text-black">No offline guides saved</div>
            <p className="mt-2 text-[16px] text-[#5e5e5e] leading-relaxed max-w-sm mx-auto">
              No guides are stored on this device yet. Tap &apos;Add guide&apos; to search and store countries, regions, or cities.
            </p>
          </div>
        )}
      </div>

      {/* Preferences Section */}
      <div className="flex flex-col mt-4">
        <h2 className="text-[24px] font-bold tracking-tight text-black mb-2">Preferences</h2>
        <div className="flex flex-col">
          
          <div className="flex min-h-[72px] w-full items-center justify-between gap-4 py-4 transition-colors border-b border-[#efefef]">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="grid size-[32px] shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-black">
                <Wifi className="size-[16px]" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[16px] font-bold text-black">Only download over Wi-Fi</span>
                <span className="truncate text-[14px] text-[#5e5e5e]">Restrict map and media sync to Wi-Fi</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={wifiOnly}
                onChange={(e) => setWifiOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#efefef] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          <div className="flex min-h-[72px] w-full items-center justify-between gap-4 py-4 transition-colors border-b border-[#efefef]">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="grid size-[32px] shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-black">
                <Database className="size-[16px]" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[16px] font-bold text-black">Auto-update packages</span>
                <span className="truncate text-[14px] text-[#5e5e5e]">Fetch spot changes in background</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoUpdate}
                onChange={(e) => setAutoUpdate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#efefef] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          <div className="flex min-h-[72px] w-full items-center justify-between gap-4 py-4 transition-colors">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="grid size-[32px] shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-black">
                <Layers className="size-[16px]" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[16px] font-bold text-black">High-resolution photos</span>
                <span className="truncate text-[14px] text-[#5e5e5e]">Increases storage requirements by 2x</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hdImages}
                onChange={(e) => setHdImages(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#efefef] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

        </div>
      </div>

      {/* Slide-over Global Search & Selector Overlay */}
      {showSelector && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 transition-all duration-300 animate-in fade-in backdrop-blur-sm">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setShowSelector(false)} />

          <div className="relative flex h-full w-full max-w-lg flex-col bg-white px-6 py-8 shadow-2xl animate-in slide-in-from-right duration-300 sm:px-8">
            
            <div className="flex items-center justify-between pb-6">
              <div>
                <h3 className="text-[32px] font-bold text-black tracking-tight">
                  Add guide
                </h3>
                <p className="text-[16px] text-[#5e5e5e] mt-1">
                  Search globally for any location
                </p>
              </div>
              <button
                onClick={() => setShowSelector(false)}
                className="grid size-10 place-items-center rounded-full bg-[#f3f3f3] hover:bg-[#e2e2e2] text-black transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Smart Universal Geocoding Input */}
            <div className="mb-6 relative">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#5e5e5e]" />
              <input
                type="text"
                placeholder="Search (e.g. Paris, Tuscany...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 w-full bg-[#f3f3f3] pl-12 pr-4 text-[16px] text-black placeholder-[#afafaf] outline-none rounded-[8px] focus:ring-2 focus:ring-black transition-all"
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 className="size-5 text-black animate-spin" />
                </div>
              )}
            </div>

            {/* Dynamic Results vs Browsing Hierarchy */}
            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
              
              {searchQuery.trim().length >= 2 ? (
                <div className="flex flex-col">
                  <div className="text-[14px] font-bold text-[#5e5e5e] mb-2 px-2">
                    Search results
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="flex flex-col">
                      {searchResults.map((item) => {
                        const isItemDownloaded = !!downloaded[item.id];
                        const isItemDownloading = !!downloading[item.id];

                        return (
                          <div key={item.id} className="border-b border-[#efefef] last:border-0">
                            <div
                              className="flex min-h-[72px] items-center justify-between gap-4 py-4 px-4 rounded-2xl hover:bg-[#f9f9f9] transition-all"
                            >
                              <div className="min-w-0 flex items-center gap-4">
                                <div className="grid size-[40px] shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-black">
                                  {getTypeIcon(item.type)}
                                </div>
                                <div className="min-w-0">
                                  <span className="block text-[16px] font-bold text-black truncate leading-tight">
                                    {item.name}
                                  </span>
                                  <span className="block text-[14px] text-[#5e5e5e] truncate mt-0.5">
                                    {item.fullName}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                <span className="text-[14px] font-bold text-[#5e5e5e]">
                                  {item.sizeMb} MB
                                </span>
                                {isItemDownloaded ? (
                                  <span className="flex size-10 items-center justify-center bg-black text-white rounded-full">
                                    <Check className="size-5" />
                                  </span>
                                ) : isItemDownloading ? (
                                  <span className="flex size-10 items-center justify-center bg-[#efefef] text-black rounded-full">
                                    <Loader2 className="size-5 animate-spin" />
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleAddDownload(item)}
                                    className="flex size-10 items-center justify-center bg-black text-white hover:bg-black/90 rounded-full transition-transform active:scale-95"
                                    title="Download package"
                                  >
                                    <Download className="size-5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !isSearching && (
                      <div className="text-center py-12">
                        <div className="grid size-[64px] mx-auto place-items-center rounded-full bg-[#f3f3f3] mb-4">
                          <CircleAlert className="size-8 text-[#afafaf]" />
                        </div>
                        <div className="text-[20px] font-bold text-black">No matches found</div>
                        <p className="text-[16px] text-[#5e5e5e] mt-2 max-w-xs mx-auto leading-relaxed">
                          Try adjusting spelling or searching for standard countries, regions, or major cities.
                        </p>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="flex flex-col">
                  
                  <div className="text-[24px] font-bold tracking-tight text-black mb-4 px-2">
                    Curated destinations
                  </div>

                  <div className="flex flex-col">
                    {hierarchyData.map((country) => {
                      const isCountryDownloaded = !!downloaded[country.id];
                      const isCountryDownloading = !!downloading[country.id];
                      const countryExpanded = expandedCountries[country.id];

                      return (
                        <div key={country.id} className="border-b border-[#efefef] last:border-0">
                          {/* Country Row */}
                          <div className="flex min-h-[72px] items-center justify-between gap-4 py-4 px-4 rounded-2xl hover:bg-[#f9f9f9] transition-all">
                            <button
                              onClick={() => setExpandedCountries((prev) => ({ ...prev, [country.id]: !prev[country.id] }))}
                              className="flex flex-1 items-center gap-4 text-left font-bold text-[18px] text-black min-w-0"
                            >
                              <div className="grid size-[40px] shrink-0 place-items-center rounded-full bg-[#f3f3f3] text-black">
                                <Globe className="size-5" />
                              </div>
                              <span className="truncate">{country.name}</span>
                              {countryExpanded ? (
                                <ChevronDown className="size-5 text-[#afafaf] shrink-0" />
                              ) : (
                                <ChevronRight className="size-5 text-[#afafaf] shrink-0" />
                              )}
                            </button>

                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-[14px] font-bold text-[#5e5e5e]">
                                {country.sizeMb} MB
                              </span>
                              {isCountryDownloaded ? (
                                <span className="flex size-10 items-center justify-center bg-black text-white rounded-full">
                                  <Check className="size-5" />
                                </span>
                              ) : isCountryDownloading ? (
                                <span className="flex size-10 items-center justify-center bg-[#efefef] text-black rounded-full">
                                  <Loader2 className="size-5 animate-spin" />
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAddHierarchyDownload(country.id, country.name, "country", country.sizeMb)}
                                  className="flex size-10 items-center justify-center bg-[#f3f3f3] text-black hover:bg-[#e2e2e2] rounded-full transition-transform active:scale-95"
                                  title="Download country"
                                >
                                  <Download className="size-5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Country Details (Regions) */}
                          {countryExpanded && country.regions.length > 0 && (
                            <div className="pl-6 border-l-2 border-[#f3f3f3] ml-6 mb-4 flex flex-col">
                              {country.regions.map((region) => {
                                const isRegionDownloaded = isCountryDownloaded || !!downloaded[region.id];
                                const isRegionDownloading = !!downloading[region.id];
                                const regionExpanded = expandedRegions[region.id];

                                return (
                                  <div key={region.id} className="flex flex-col">
                                    {/* Region Row */}
                                    <div className="flex min-h-[64px] items-center justify-between gap-4 py-2 px-4 rounded-2xl hover:bg-[#f9f9f9] transition-all">
                                      <button
                                        onClick={() => setExpandedRegions((prev) => ({ ...prev, [region.id]: !prev[region.id] }))}
                                        className="flex flex-1 items-center gap-3 text-left font-bold text-[16px] text-black min-w-0"
                                      >
                                        <MapIcon className="size-4 text-[#afafaf] shrink-0" />
                                        <span className="truncate">{region.name}</span>
                                        {regionExpanded ? (
                                          <ChevronDown className="size-4 text-[#afafaf] shrink-0" />
                                        ) : (
                                          <ChevronRight className="size-4 text-[#afafaf] shrink-0" />
                                        )}
                                      </button>

                                      <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-[14px] font-medium text-[#5e5e5e]">
                                          {region.sizeMb} MB
                                        </span>
                                        {isRegionDownloaded ? (
                                          <span className="flex size-8 items-center justify-center bg-black text-white rounded-full opacity-60">
                                            <Check className="size-4" />
                                          </span>
                                        ) : isRegionDownloading ? (
                                          <span className="flex size-8 items-center justify-center bg-[#efefef] text-black rounded-full">
                                            <Loader2 className="size-4 animate-spin" />
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => handleAddHierarchyDownload(region.id, region.name, "region", region.sizeMb)}
                                            className="flex size-8 items-center justify-center bg-[#f3f3f3] text-black hover:bg-[#e2e2e2] rounded-full transition-transform active:scale-95"
                                            title="Download region"
                                          >
                                            <Download className="size-4" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Cities under Region */}
                                    {regionExpanded && region.cities.length > 0 && (
                                      <div className="pl-6 border-l-2 border-[#f3f3f3] ml-2 mb-2 flex flex-col gap-1">
                                        {region.cities.map((city) => {
                                          const isCityDownloaded = isRegionDownloaded || !!downloaded[city.id];
                                          const isCityDownloading = !!downloading[city.id];

                                          return (
                                            <div key={city.id} className="flex min-h-[56px] items-center justify-between gap-4 py-2 hover:bg-[#f9f9f9] transition-all">
                                              <div className="min-w-0">
                                                <div className="flex items-center gap-2 text-[14px] font-bold text-black">
                                                  <Building2 className="size-4 text-[#afafaf] shrink-0" />
                                                  <span className="truncate">{city.name}</span>
                                                </div>
                                                <div className="mt-0.5 text-[14px] text-[#5e5e5e] pl-6">
                                                  {city.spotsCount} spots • {city.walksCount} walks
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-[14px] font-medium text-[#5e5e5e]">
                                                  {city.sizeMb} MB
                                                </span>
                                                {isCityDownloaded ? (
                                                  <span className="flex size-8 items-center justify-center bg-black text-white rounded-full opacity-60">
                                                    <Check className="size-4" />
                                                  </span>
                                                ) : isCityDownloading ? (
                                                  <span className="flex size-8 items-center justify-center bg-[#efefef] text-black rounded-full">
                                                    <Loader2 className="size-4 animate-spin" />
                                                  </span>
                                                ) : (
                                                  <button
                                                    onClick={() => handleAddHierarchyDownload(city.id, city.name, "city", city.sizeMb)}
                                                    className="flex size-8 items-center justify-center bg-[#f3f3f3] text-black hover:bg-[#e2e2e2] rounded-full transition-transform active:scale-95"
                                                    title="Download city guide"
                                                  >
                                                    <Download className="size-4" />
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
          </div>
        </div>
      )}

    </div>
  );
}
