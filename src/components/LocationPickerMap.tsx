"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/lib/geo";

// Leafletの既定マーカー画像はバンドラー経由だとパスが壊れるため、
// public/leaflet/ に配置した実体を直接参照するよう上書きする
const markerIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// 現在地を表す青い丸ドット(選択ピンとは見た目を分ける)
const currentLocationIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:16px;height:16px;border-radius:50%;background:#4285F4;' +
    'border:2px solid #fff;box-shadow:0 0 0 2px rgba(66,133,244,0.35);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function ClickHandler({ onSelect }: { onSelect: (point: GeoPoint) => void }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

type Props = {
  /** 初期表示の中心地点（マウント後の変更では再センタリングしない） */
  initialCenter: GeoPoint;
  /** 選択済みの地点。未選択ならマーカーを表示しない */
  value: GeoPoint | null;
  onSelect: (point: GeoPoint) => void;
  /** 現在地(取得済みなら「現在地」ボタンを表示する) */
  currentPosition?: GeoPoint | null;
  /** 地図の高さ(px指定 or "100%"などのCSS値) */
  height?: number | string;
  /** 地図の角丸(px)。全画面表示など縁いっぱいに使う場合は0を指定する */
  borderRadius?: number;
};

/**
 * タップ/クリックした地点にマーカーを立てて位置を選択させる地図。OpenStreetMapタイルを使用。
 * Leafletはwindow/documentに依存しSSR非対応なため、呼び出し側で
 * next/dynamic(..., { ssr: false }) 経由で読み込むこと。
 */
export default function LocationPickerMap({
  initialCenter,
  value,
  onSelect,
  currentPosition,
  height = 440,
  borderRadius = 12,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);

  // ダイアログのアニメーション中などコンテナがまだ最終サイズになっていない状態で
  // Leafletが初期サイズを測定してしまうと、タイルが正しく表示されないことがある。
  // マウント後に一度サイズを再計算させて確実に描画させる。
  useEffect(() => {
    const id = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 300);
    return () => clearTimeout(id);
  }, []);

  const handleGoToCurrentLocation = () => {
    if (!currentPosition) return;
    mapRef.current?.flyTo([currentPosition.lat, currentPosition.lng], 17);
  };

  return (
    <Box sx={{ position: "relative", height, width: "100%" }}>
      <MapContainer
        ref={mapRef}
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={16}
        maxZoom={19}
        style={{ height: "100%", width: "100%", borderRadius }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ClickHandler onSelect={onSelect} />
        {currentPosition && (
          <Marker
            position={[currentPosition.lat, currentPosition.lng]}
            icon={currentLocationIcon}
            zIndexOffset={-1000}
            interactive={false}
          />
        )}
        {value && <Marker position={[value.lat, value.lng]} icon={markerIcon} />}
      </MapContainer>

      {currentPosition && (
        <Tooltip title="現在地を使う">
          <IconButton
            onClick={handleGoToCurrentLocation}
            sx={{
              position: "absolute",
              bottom: 12,
              right: 12,
              zIndex: 1000,
              bgcolor: "background.paper",
              boxShadow: 3,
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            <MyLocationIcon color="primary" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
