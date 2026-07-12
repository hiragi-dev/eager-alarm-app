import type { GeoPoint } from "@/lib/geo";

/**
 * ユーザーが登録した「アラームの止め方」のうち位置情報ベースのもの。
 * 複数登録でき、それぞれ好きな名前(label)を付けられる。アラーム側は
 * stop_method_id でこのうちどれを使うかを参照する(1つのアラームにつき1つ、必須)。
 * edgeデバイスには一切送らない、ブラウザ内(localStorage)だけの概念
 * （GPS座標はedge側では扱わないため）。
 */
export type StopMethod = GeoPoint & {
  id: string;
  label: string;
  radiusMeters: number;
  createdAt: number;
};

export const STOP_METHOD_STORAGE_KEY = "alarm-stop-methods";
export const DEFAULT_STOP_METHOD_RADIUS_METERS = 20;
