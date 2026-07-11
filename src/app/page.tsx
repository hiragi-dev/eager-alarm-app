"use client";

import { useState, type SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import AlarmControl from "@/components/AlarmControl";
import ArrivalStopBridge from "@/components/ArrivalStopBridge";
import GyroTest from "@/components/GyroTest";
import LocationSettings from "@/components/LocationSettings";
import MqttControl from "@/components/MqttControl";
import StopAlarmControl from "@/components/StopAlarmControl";
import WalkPauseBridge from "@/components/WalkPauseBridge";
import GyroProvider from "@/contexts/GyroProvider";
import LocationProvider from "@/contexts/LocationProvider";
import MqttProvider from "@/contexts/MqttProvider";
import NotificationProvider from "@/contexts/NotificationProvider";
import StopSequenceProvider from "@/contexts/StopSequenceProvider";

type TabKey = "settings" | "alarms" | "stop" | "location" | "gyro";

export default function Home() {
  const [tab, setTab] = useState<TabKey>("settings");

  const handleChange = (_event: SyntheticEvent, value: TabKey) => {
    setTab(value);
  };

  return (
    <NotificationProvider>
      <MqttProvider>
        <GyroProvider>
          <LocationProvider>
            <StopSequenceProvider>
              <WalkPauseBridge />
              <ArrivalStopBridge />
              <Container maxWidth="sm">
                <Box sx={{ py: 6 }}>
                  <Stack spacing={1} sx={{ mb: 3 }}>
                    <Typography variant="h4" component="h1">
                      eager-alarm
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      MQTT 経由で Raspberry Pi（eager-alarm-edge）のアラームを制御します。
                    </Typography>
                  </Stack>

                  <Tabs
                    value={tab}
                    onChange={handleChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ mb: 3 }}
                  >
                    <Tab label="MQTT設定" value="settings" />
                    <Tab label="アラーム" value="alarms" />
                    <Tab label="アラームを止める" value="stop" />
                    <Tab label="位置情報" value="location" />
                    <Tab label="ジャイロ" value="gyro" />
                  </Tabs>

                  <Box role="tabpanel" hidden={tab !== "settings"}>
                    {tab === "settings" && <MqttControl />}
                  </Box>
                  <Box role="tabpanel" hidden={tab !== "alarms"}>
                    {tab === "alarms" && <AlarmControl />}
                  </Box>
                  <Box role="tabpanel" hidden={tab !== "stop"}>
                    {tab === "stop" && <StopAlarmControl />}
                  </Box>
                  <Box role="tabpanel" hidden={tab !== "location"}>
                    {tab === "location" && <LocationSettings />}
                  </Box>
                  <Box role="tabpanel" hidden={tab !== "gyro"}>
                    {tab === "gyro" && <GyroTest />}
                  </Box>
                </Box>
              </Container>
            </StopSequenceProvider>
          </LocationProvider>
        </GyroProvider>
      </MqttProvider>
    </NotificationProvider>
  );
}
