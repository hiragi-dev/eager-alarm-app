import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MqttControl from "@/components/MqttControl";

export default function Home() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 6 }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1">
            MQTT 送信デモ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ブラウザから MQTT (over WebSocket) でコマンドを送信し、Raspberry Pi
            側の購読スクリプトに届くかを確認するデモです。
          </Typography>
        </Stack>
        <MqttControl />
      </Box>
    </Container>
  );
}
