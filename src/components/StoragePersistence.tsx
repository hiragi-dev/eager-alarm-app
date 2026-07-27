"use client";

import { useEffect } from "react";

/**
 * ストレージの永続化(navigator.storage.persist)を要求するだけの不可視コンポーネント。
 *
 * MQTT設定(src/lib/mqtt.ts)と停止方法(src/lib/stopMethod.ts)はlocalStorageにしか
 * 存在せず、ブラウザにストレージを追い出されると再入力するまでアプリが使えなくなる。
 * 永続化を要求しておくと、少なくともChrome系では自動削除の対象から外れる。
 *
 * 許可されるかはブラウザの裁量で、Safariのように未対応の環境もある。
 * 失敗しても他の機能には影響しないため、結果は握り潰さずログにのみ残す。
 */
export default function StoragePersistence() {
  useEffect(() => {
    if (!navigator.storage?.persist || !navigator.storage.persisted) return;

    navigator.storage
      .persisted()
      .then((already) => (already ? true : navigator.storage.persist()))
      .then((granted) => {
        if (!granted) {
          console.info(
            "ストレージの永続化は許可されませんでした。設定がブラウザに削除される場合があります。",
          );
        }
      })
      .catch((error) => {
        console.info("ストレージの永続化を要求できませんでした:", error);
      });
  }, []);

  return null;
}
