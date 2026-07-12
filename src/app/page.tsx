"use client";

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import AlarmControl from "@/components/AlarmControl";
import AlarmIcon from "@mui/icons-material/Alarm";
import SettingsIcon from "@mui/icons-material/Settings";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import ArrivalStopBridge from "@/components/ArrivalStopBridge";
import LocationSettings from "@/components/LocationSettings";
import MqttControl from "@/components/MqttControl";
import StopAlarmControl from "@/components/StopAlarmControl";
import StopMethodSettings from "@/components/StopMethodSettings";
import WalkPauseBridge from "@/components/WalkPauseBridge";
import WalkSensorSettings from "@/components/WalkSensorSettings";
import WalkSensorProvider from "@/contexts/WalkSensorProvider";
import LocationProvider from "@/contexts/LocationProvider";
import MqttProvider from "@/contexts/MqttProvider";
import NotificationProvider from "@/contexts/NotificationProvider";
import StopMethodProvider from "@/contexts/StopMethodProvider";
import RingingAlert from "@/components/RingingAlert";

type TabKey = "settings" | "alarms" | "stop";
type SettingsViewKey = "menu" | "mqtt" | "location" | "walkSensor";
type StopViewKey = "control" | "methods";

export default function Home() {
  const [tab, setTab] = useState<TabKey>("alarms");
  const [settingsView, setSettingsView] = useState<SettingsViewKey>("menu");
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
                  <Box role="tabpanel" hidden={tab !== "settings"} sx={{ height: "100%" }}>
                    {tab === "settings" && (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
                        <Box
                          sx={{
                            position: "relative",
                            flex: 1,
                            minHeight: 0,
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              overflowY: "auto",
                              px: 0.25,
                              pb: 2,
                              transform: settingsView === "menu" ? "translateX(0%)" : "translateX(-100%)",
                              transition: "transform 180ms ease",
                              pointerEvents: settingsView === "menu" ? "auto" : "none",
                            }}
                          >
                            <List
                              sx={{
                                bgcolor: "rgba(255,255,255,0.04)",
                                borderRadius: 3,
                                border: "1px solid rgba(217, 255, 77, 0.12)",
                              }}
                            >
                              <ListItemButton onClick={() => setSettingsView("mqtt")}>
                                <ListItemText primary="MQTT設定" secondary="接続先サーバーを設定" />
                                <Box component="span" sx={{ ml: 1, color: "text.secondary", fontSize: "1.1rem" }}>
                                  ›
                                </Box>
                              </ListItemButton>
                              <ListItemButton onClick={() => setSettingsView("location")}>
                                <ListItemText primary="位置情報" secondary="位置情報の許可と設定" />
                                <Box component="span" sx={{ ml: 1, color: "text.secondary", fontSize: "1.1rem" }}>
                                  ›
                                </Box>
                              </ListItemButton>
                              <ListItemButton onClick={() => setSettingsView("walkSensor")}>
                                <ListItemText primary="歩行検知" secondary="歩行検知の許可と確認" />
                                <Box component="span" sx={{ ml: 1, color: "text.secondary", fontSize: "1.1rem" }}>
                                  ›
                                </Box>
                              </ListItemButton>
                            </List>
                          </Box>

                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              overflowY: "auto",
                              px: 0.25,
                              pb: 2,
                              transform: settingsView === "menu" ? "translateX(100%)" : "translateX(0%)",
                              transition: "transform 180ms ease",
                              pointerEvents: settingsView === "menu" ? "none" : "auto",
                            }}
                          >
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <Button
                                variant="text"
                                color="primary"
                                onClick={() => setSettingsView("menu")}
                                sx={{ alignSelf: "flex-start", px: 0, mb: 0.5 }}
                              >
                                ← 設定一覧へ戻る
                              </Button>

                              {settingsView === "mqtt" && <MqttControl />}
                              {settingsView === "location" && <LocationSettings />}
                              {settingsView === "walkSensor" && <WalkSensorSettings />}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    )}
                  </Box>
                  <Box role="tabpanel" hidden={tab !== "alarms"} sx={{ height: "100%" }}>
                    {tab === "alarms" && <AlarmControl />}
                  </Box>
                  <Box role="tabpanel" hidden={tab !== "stop"} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
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
