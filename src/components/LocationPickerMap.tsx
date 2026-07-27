"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
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
  /** 選択地点に描画する到達判定半径(m)。valueが無ければ描画しない */
  radiusMeters?: number;
  /** 指定すると地図下部に半径調整スライダーを表示する */
  onRadiusChange?: (radiusMeters: number) => void;
  minRadiusMeters?: number;
  maxRadiusMeters?: number;
  /**
   * 閲覧専用。タップしても地点を選択せず、半径スライダーも表示しない。
   * 登録済みの停止方法がどこなのかを確認するだけの用途で使う
   */
  readOnly?: boolean;
};

/**
 * タップ/クリックした地点にマーカーを立てて位置を選択させる地図。OpenStreetMapタイルを使用。
 * 到達判定半径(radiusMeters)を指定すると選択地点に円を描画し、onRadiusChangeを渡すと
 * 地図下部に半径調整スライダーを表示する。readOnly を指定すると選択・半径調整を行わない
 * 閲覧専用の地図になる(登録済みの地点を確認するだけの用途)。
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
  radiusMeters,
  onRadiusChange,
  minRadiusMeters = 5,
  maxRadiusMeters = 200,
  readOnly = false,
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

  const showRadiusSlider = !!onRadiusChange && !!value && !readOnly;

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
        {!readOnly && <ClickHandler onSelect={onSelect} />}
        {currentPosition && (
          <Marker
            position={[currentPosition.lat, currentPosition.lng]}
            icon={currentLocationIcon}
            zIndexOffset={-1000}
            interactive={false}
          />
        )}
        {value && radiusMeters != null && radiusMeters > 0 && (
          <Circle
            center={[value.lat, value.lng]}
            radius={radiusMeters}
            pathOptions={{ color: "#4285F4", fillColor: "#4285F4", fillOpacity: 0.15, weight: 2 }}
          />
        )}
        {value && <Marker position={[value.lat, value.lng]} icon={markerIcon} />}
      </MapContainer>

      {currentPosition && (
        <Tooltip title={readOnly ? "現在地へ移動" : "現在地を使う"}>
          <IconButton
            onClick={handleGoToCurrentLocation}
            sx={{
              position: "absolute",
              top: 12,
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

      {showRadiusSlider && (
        <Box
          sx={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 1000,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 3,
            px: 2,
            py: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            到達判定の半径: {radiusMeters}m
          </Typography>
          <Slider
            size="small"
            value={radiusMeters ?? minRadiusMeters}
            onChange={(_event, next) => onRadiusChange?.(next as number)}
            min={minRadiusMeters}
            max={maxRadiusMeters}
            step={5}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}m`}
          />
        </Box>
      )}
    </Box>
  );
}
