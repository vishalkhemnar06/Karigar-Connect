// src/pages/client/ClientNearbyShops.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import { motion } from 'framer-motion';
import {
  Store,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
  BadgePercent,
  Navigation,
  Package2,
  ImageOff,
  ShieldCheck,
} from 'lucide-react';

const formatMoney = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getDistanceKm = (from, to) => {
  const lat1 = toNumber(from?.latitude);
  const lon1 = toNumber(from?.longitude);
  const lat2 = toNumber(to?.latitude);
  const lon2 = toNumber(to?.longitude);

  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;

  const earthRadiusKm = 6371;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusKm * c * 10) / 10;
};

const getBrowserLocation = () => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Geolocation is not available in this browser.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
};

const getProductPrice = (price = 0, discountPct = 0) => {
  const base = Number(price || 0);
  const pct = Number(discountPct || 0);
  return Math.max(0, Math.round(base - (base * pct) / 100));
};

const openShopMap = (shop = {}) => {
  const lat = Number(shop?.shopLocation?.latitude);
  const lng = Number(shop?.shopLocation?.longitude);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer');
    return;
  }

  const query = [shop?.shopName, shop?.shopLocation?.address, shop?.address, shop?.city].filter(Boolean).join(', ');
  if (query) {
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  }
};

const ShopProductCard = ({ product, discountPct }) => {
  const basePrice = Number(product?.price || 0);
  const finalPrice = getProductPrice(basePrice, discountPct);
  const savings = Math.max(0, basePrice - finalPrice);

  return (
    <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/40 p-3 shadow-sm">
      <div className="flex gap-3">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-orange-100 bg-white">
          {product?.image ? (
            <img
              src={getImageUrl(product.image)}
              alt={product?.name || 'Product'}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-orange-50 text-orange-300">
              <ImageOff size={18} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{product?.name || 'Product'}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{product?.description || 'No description shared by the shop yet.'}</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              {product?.stock > 0 ? 'In stock' : 'Out'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-gray-900">{formatMoney(finalPrice)}</span>
            {discountPct > 0 && (
              <>
                <span className="text-gray-400 line-through">{formatMoney(basePrice)}</span>
                <span className="font-semibold text-emerald-700">Save {formatMoney(savings)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ClientNearbyShops = () => {
  const [client, setClient] = useState(null);
  const [shops, setShops] = useState([]);
  const [productsByShopId, setProductsByShopId] = useState({});
  const [discountInfo, setDiscountInfo] = useState({ completedJobs: 0, discountPct: 10 });
  const [clientCoords, setClientCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [error, setError] = useState('');

  const visibleShops = useMemo(() => {
    const rankedShops = [...shops].map((shop) => {
      const distanceKm = getDistanceKm(clientCoords, shop?.shopLocation);
      return { ...shop, distanceKm };
    });

    return rankedShops.sort((left, right) => {
      const leftDistance = Number.isFinite(left.distanceKm) ? left.distanceKm : Number.POSITIVE_INFINITY;
      const rightDistance = Number.isFinite(right.distanceKm) ? right.distanceKm : Number.POSITIVE_INFINITY;

      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      return String(left?.shopName || '').localeCompare(String(right?.shopName || ''));
    });
  }, [shops, clientCoords]);

  const loadNearbyShops = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    setLocationError('');
    setLocating(true);

    try {
      const [locationRes, profileRes, discountRes, shopsRes] = await Promise.allSettled([
        getBrowserLocation(),
        api.getClientProfile(),
        api.getClientMarketplaceDiscount(),
        api.getApprovedShops(),
      ]);

      const nextCoords = locationRes.status === 'fulfilled' ? locationRes.value : null;
      if (nextCoords) {
        setClientCoords(nextCoords);
      } else {
        setClientCoords(null);
        setLocationError('Enable location access to sort shops by true distance.');
      }

      const nextClient = profileRes.status === 'fulfilled' ? (profileRes.value?.data || null) : null;
      const nextDiscount = discountRes.status === 'fulfilled'
        ? {
            completedJobs: Number(discountRes.value?.data?.completedJobs || 0),
            discountPct: Number(discountRes.value?.data?.discountPct || 10),
          }
        : { completedJobs: 0, discountPct: 10 };
      const nextShops = shopsRes.status === 'fulfilled' && Array.isArray(shopsRes.value?.data)
        ? shopsRes.value.data
        : [];

      setClient(nextClient);
      setDiscountInfo(nextDiscount);
      setShops(nextShops);

      const productEntries = await Promise.allSettled(
        nextShops.map(async (shop) => {
          const response = await api.getShopPublicProducts(shop._id);
          return [shop._id, Array.isArray(response?.data) ? response.data : []];
        })
      );

      const nextProducts = {};
      productEntries.forEach((entry) => {
        if (entry.status === 'fulfilled' && Array.isArray(entry.value)) {
          const [shopId, products] = entry.value;
          nextProducts[shopId] = products;
        }
      });

      setProductsByShopId(nextProducts);
    } catch (fetchError) {
      console.error('Nearby shops fetch error:', fetchError);
      setError('Unable to load nearby shops right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    loadNearbyShops();
  }, [loadNearbyShops]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-amber-50/20 pb-16">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          data-guide-id="client-page-nearby-shops"
          className="mb-6"
        >
          <div className="overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 p-6 text-white shadow-xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em]">
                  <Store size={12} /> Nearby Shops
                </div>
                <h1 className="text-2xl font-black sm:text-3xl">Buy materials from approved shops near you</h1>
                <p className="mt-2 text-sm text-white/90">
                  Shops are sorted by your live GPS location, with contact details and every public product preview shown inline.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/15 px-4 py-3 text-center backdrop-blur-sm">
                  <p className="text-2xl font-black">{visibleShops.length}</p>
                  <p className="text-[10px] text-white/80">Shops</p>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-3 text-center backdrop-blur-sm">
                  <p className="text-2xl font-black">{discountInfo.discountPct}%</p>
                  <p className="text-[10px] text-white/80">Discount</p>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-3 text-center backdrop-blur-sm col-span-2 sm:col-span-1">
                  <p className="text-2xl font-black">{discountInfo.completedJobs}</p>
                  <p className="text-[10px] text-white/80">Completed jobs</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-500">Discount</p>
                <h2 className="text-xl font-bold text-gray-900">Automatic material savings</h2>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700">
                <BadgePercent size={16} /> {discountInfo.discountPct}% off, no coupon code
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Applied automatically for your account</p>
              <p className="mt-1">
                This discount is based on your completed jobs count and is shown directly on product pricing. No coupon code is required.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">Location</p>
                <h2 className="text-xl font-bold text-gray-900">Nearest approved shops</h2>
              </div>
              {(refreshing || locating) && <RefreshCw size={16} className="animate-spin text-emerald-600" />}
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {clientCoords
                ? 'Sorted by live distance from your current location.'
                : 'Distance sort will activate after you allow location access.'}
            </p>
            {locationError && (
              <p className="mt-2 text-xs font-medium text-amber-700">{locationError}</p>
            )}
            <button
              type="button"
              onClick={() => loadNearbyShops(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh shops
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
                <div className="h-40 rounded-2xl bg-orange-50" />
                <div className="mt-4 space-y-3">
                  <div className="h-4 w-1/2 rounded-full bg-gray-100" />
                  <div className="h-3 w-2/3 rounded-full bg-gray-100" />
                  <div className="h-24 rounded-2xl bg-gray-50" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleShops.length > 0 ? (
          <div className="space-y-5">
            {visibleShops.map((shop) => {
              const products = productsByShopId[shop._id] || [];
              const mapLabel = shop?.shopLocation?.latitude && shop?.shopLocation?.longitude ? 'Open live location' : 'Open map';
              const distanceLabel = Number.isFinite(shop?.distanceKm) ? `${shop.distanceKm} km away` : 'Distance unavailable';
              const hasCoords = Number.isFinite(shop?.distanceKm);

              return (
                <motion.section
                  key={shop._id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-lg"
                >
                  <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
                    <div className="relative min-h-[260px] bg-gradient-to-br from-orange-100 via-amber-50 to-white p-5">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.16),transparent_36%)]" />
                      <div className="relative flex h-full flex-col justify-between">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-500">Approved Shop</p>
                            <h3 className="mt-1 text-2xl font-black leading-tight text-gray-900">{shop?.shopName || 'Shop'}</h3>
                            <p className="mt-1 text-sm text-gray-500">{shop?.locality || shop?.city || 'Location shared by shop'}</p>
                          </div>

                          <div className={`rounded-2xl px-3 py-2 text-right text-xs font-bold ${hasCoords ? 'bg-emerald-500 text-white' : 'bg-white/85 text-gray-600'} shadow-sm backdrop-blur`}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Navigation size={12} />
                              <span>{distanceLabel}</span>
                            </div>
                          </div>

                          <div className="rounded-2xl bg-white/85 p-2 shadow-sm backdrop-blur">
                            {shop?.shopLogo || shop?.shopPhoto ? (
                              <img
                                src={getImageUrl(shop.shopLogo || shop.shopPhoto)}
                                alt={shop?.shopName || 'Shop'}
                                className="h-16 w-16 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-orange-50 text-orange-400">
                                <Store size={24} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-2xl border border-orange-100 bg-white/85 p-4 backdrop-blur-sm">
                            <div className="flex items-start gap-2 text-sm text-gray-700">
                              <MapPin size={15} className="mt-0.5 flex-shrink-0 text-orange-500" />
                              <span>{shop?.shopLocation?.address || shop?.address || shop?.city || 'Location not shared yet'}</span>
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                              <Phone size={15} className="text-orange-500" />
                              <a href={`tel:${shop?.mobile || ''}`} className="font-semibold text-orange-700 hover:underline">
                                {shop?.mobile || 'Not shared'}
                              </a>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                              <Mail size={15} className="text-orange-500" />
                              <span className="truncate">{shop?.email || 'Not shared'}</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openShopMap(shop)}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.01]"
                            >
                              <Navigation size={14} /> {mapLabel}
                            </button>
                            <a
                              href={`mailto:${shop?.email || ''}`}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-50"
                            >
                              <Mail size={14} /> Email
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">Product preview</p>
                          <h4 className="text-lg font-bold text-gray-900">All public products</h4>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          <Package2 size={14} /> {products.length} items
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        {products.length > 0 ? products.map((product) => (
                          <ShopProductCard
                            key={product._id}
                            product={product}
                            discountPct={discountInfo.discountPct}
                          />
                        )) : (
                          <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 p-5 text-sm text-gray-600 xl:col-span-2">
                            This shop has no public products listed yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-orange-200 bg-white p-10 text-center shadow-sm">
            <ShieldCheck size={36} className="mx-auto text-orange-400" />
            <h3 className="mt-4 text-lg font-bold text-gray-900">No nearby shops found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {clientCoords
                ? 'We could not find approved shops with usable live location data.'
                : 'Allow location access to sort and display nearby approved shops.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientNearbyShops;