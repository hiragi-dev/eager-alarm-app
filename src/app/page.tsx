"use client";

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import AlarmControl from "@/components/AlarmControl";
import AlarmIcon from "@mui/icons-material/Alarm";
import SettingsIcon from "@mui/icons-material/Settings";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import ArrivalStopBridge from "@/components/ArrivalStopBridge";
import MqttControl from "@/components/MqttControl";
import StopAlarmControl from "@/components/StopAlarmControl";
import StopMethodSettings from "@/components/StopMethodSettings";
import WalkPauseBridge from "@/components/WalkPauseBridge";
import WalkSensorPermissionBridge from "@/components/WalkSensorPermissionBridge";
import WalkSensorProvider from "@/contexts/WalkSensorProvider";
import LocationProvider from "@/contexts/LocationProvider";
import MqttProvider from "@/contexts/MqttProvider";
import NotificationProvider from "@/contexts/NotificationProvider";
import StopMethodProvider from "@/contexts/StopMethodProvider";
import RingingAlert from "@/components/RingingAlert";

type TabKey = "settings" | "alarms" | "stop";
type StopViewKey = "control" | "methods";

/**
 * タブパネル共通のスタイル。
 *
 * hidden属性による display:none はブラウザ標準のスタイルなので、sxでdisplayを
 * 指定すると(作成者スタイルが優先されるため)打ち消されてしまう。非表示のはずの
 * パネルが height:100% の flex アイテムとして残ると、表示中のパネルと場所を
 * 分け合って両方が縮み、画面の半分しか使えなくなる。
 * hidden時は必ず消えるよう、属性セレクタで明示しておく。
 */
const tabPanelSx = {
  height: "100%",
  "&[hidden]": { display: "none" },
} as const;

export default function Home() {
  const [tab, setTab] = useState<TabKey>("alarms");
  const [stopView, setStopView] = useState<StopViewKey>("control");

  const navigationItems: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
    { key: "settings", label: "設定", icon: <SettingsIcon /> },
    { key: "alarms", label: "アラーム", icon: <AlarmIcon /> },
    { key: "stop", label: "停止", icon: <StopCircleIcon /> },
  ];

  const handleGoToStop = () => {
    setStopView("control");
    setTab("stop");
  };

  return (
    <NotificationProvider>
      <MqttProvider>
        <WalkSensorProvider>
          <LocationProvider>
            <StopMethodProvider>
              <WalkPauseBridge />
              <WalkSensorPermissionBridge />
              <ArrivalStopBridge />
              <RingingAlert onGoToStop={handleGoToStop} />
              <Box
                sx={{
                  height: "100vh",
                  overflow: "hidden",
                  bgcolor: "#000000",
                  color: "#f7ffe8",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Container maxWidth="sm" sx={{ pt: 3, pb: 2, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <Box role="tabpanel" hidden={tab !== "settings"} sx={tabPanelSx}>
                    {tab === "settings" && (
                      <Box sx={{ height: "100%", overflowY: "auto", px: 0.25, pb: 2 }}>
                        <MqttControl />
                      </Box>
                    )}
                  </Box>
                  <Box role="tabpanel" hidden={tab !== "alarms"} sx={tabPanelSx}>
                    {tab === "alarms" && <AlarmControl />}
                  </Box>
                  <Box
                    role="tabpanel"
                    hidden={tab !== "stop"}
                    sx={{ ...tabPanelSx, display: "flex", flexDirection: "column" }}
                  >
                    {tab === "stop" && (
                      <>
                        <Tabs
                          value={stopView}
                          onChange={(_event, value: StopViewKey) => setStopView(value)}
                          variant="fullWidth"
                          sx={{ mb: 2, flexShrink: 0 }}
                        >
                          <Tab label="アラームを止める" value="control" />
                          <Tab label="停止方法" value="methods" />
                        </Tabs>
                        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                          {stopView === "control" && <StopAlarmControl />}
                          {stopView === "methods" && <StopMethodSettings />}
                        </Box>
                      </>
                    )}
                  </Box>
                </Container>

                <Box
                  sx={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 10,
                    px: 2,
                    pb: 3,
                  }}
                >
                  <Container maxWidth="sm" sx={{ px: 0 }}>
                    <Box
                      sx={{
                        overflow: "hidden",
                        borderRadius: 4,
                        bgcolor: "rgba(20, 20, 20, 0.85)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <BottomNavigation
                        showLabels
                        value={tab}
                        onChange={(event, newValue) => {
                          setTab(newValue);
                        }}
                        sx={{
                          bgcolor: "transparent",
                          height: 68,
                          "& .MuiBottomNavigationAction-root": {
                            color: "rgba(255, 255, 255, 0.5)",
                            minWidth: "auto",
                            "&.Mui-selected": {
                              color: "primary.main",
                            },
                          },
                          "& .MuiBottomNavigationAction-label": {
                            fontWeight: 600,
                            marginTop: "4px",
                            "&.Mui-selected": {
                              fontSize: "0.75rem",
                            },
                          },
                        }}
                      >
                        {navigationItems.map((item) => (
                          <BottomNavigationAction
                            key={item.key}
                            label={item.label}
                            value={item.key}
                            icon={item.icon}
                          />
                        ))}
                      </BottomNavigation>
                    </Box>
                  </Container>
                </Box>
              </Box>
            </StopMethodProvider>
          </LocationProvider>
        </WalkSensorProvider>
      </MqttProvider>
    </NotificationProvider>
  );
}
