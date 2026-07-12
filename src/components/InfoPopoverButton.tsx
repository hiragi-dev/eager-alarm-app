"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

type Props = {
  children: React.ReactNode;
  ariaLabel?: string;
};

/**
 * 長い説明文を常時表示せず、アイコンボタンを押した時だけポップオーバーで表示する。
 * ホバーではなくクリック/タップ起点にしているのはモバイル操作を考慮したもの。
 */
export default function InfoPopoverButton({ children, ariaLabel = "説明を表示" }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton size="small" aria-label={ariaLabel} onClick={(e) => setAnchorEl(e.currentTarget)}>
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { maxWidth: 320 } } }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          {children}
        </Typography>
      </Popover>
    </>
  );
}
