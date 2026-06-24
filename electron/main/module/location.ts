import { ipcMain } from "electron";
import axios from "axios";

interface PositionData {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  region: string;
}

async function getCurrentPosition(): Promise<PositionData | null> {
  try {
    const response = await axios.get("http://ip-api.com/json/", {
      params: {
        fields: "status,country,regionName,city,lat,lon",
      },
      timeout: 10000,
    });

    const data = response.data;
    if (data.status !== "success") {
      return null;
    }

    return {
      latitude: data.lat,
      longitude: data.lon,
      city: data.city,
      country: data.country,
      region: data.regionName,
    };
  } catch (error) {
    console.error("IP定位失败，尝试备用方案:", error);
    return await getPositionBackup();
  }
}

async function getPositionBackup(): Promise<PositionData | null> {
  try {
    const response = await axios.get("https://api.ipgeolocation.io/ipgeo", {
      params: {
        apiKey: "free",
      },
      timeout: 10000,
    });

    const data = response.data;
    if (!data.city) {
      return null;
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      country: data.country_name,
      region: data.state_prov,
    };
  } catch (error) {
    console.error("备用定位方案失败:", error);
    return null;
  }
}

export function initLocation() {
  ipcMain.handle("get-current-position", async () => {
    try {
      const result = await getCurrentPosition();
      return result;
    } catch (error) {
      console.error("定位服务处理失败:", error);
      return { error: (error as Error).message };
    }
  });
}