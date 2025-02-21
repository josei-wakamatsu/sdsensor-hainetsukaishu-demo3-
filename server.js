const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3093;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Cosmos DB 接続情報
const endpoint = process.env.COSMOSDB_ENDPOINT;
const key = process.env.COSMOSDB_KEY;
const client = new CosmosClient({ endpoint, key });
const databaseId = process.env.DATABASE_ID;
const containerId = process.env.CONTAINER_ID;

// ミドルウェア
app.use(cors());
app.use(express.json());

// 固定デバイス ID
const DEVICE_ID = "hainetsukaishu-demo3";

// ✅ **単価（円/kWh）**
const unitCosts = {
  electricity: 30, // 電気代
  gas: 20,         // ガス代
  kerosene: 15,    // 灯油代
  heavy_oil: 10,   // 重油代
  gas_13A: 25      // ✅ 13Aガスの追加
};

// 熱量計算関数
function calculateEnergy(tempDiff, flow) {
  const specificHeat = 4.186; // 水の比熱 (kJ/kg・℃)
  const density = 1000; // 水の密度 (kg/m³)
  return tempDiff * flow * density * specificHeat; // kJ
}

// 料金計算関数
function calculateCost(energy_kJ) {
  const kWh = energy_kJ / 3600; // kJ → kWh
  return {
    electricity: (kWh * unitCosts.electricity).toFixed(2),
    gas: (kWh * unitCosts.gas).toFixed(2),
    kerosene: (kWh * unitCosts.kerosene).toFixed(2),
    heavy_oil: (kWh * unitCosts.heavy_oil).toFixed(2),
    gas_13A: (kWh * unitCosts.gas_13A).toFixed(2), // ✅ 13Aガスの計算を追加
  };
}

// ✅ **リアルタイムの熱量とコストメリット取得**
app.get("/api/realtime", async (req, res) => {
  try {
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const querySpec = {
      query: `SELECT TOP 1 * FROM c WHERE c.device = @deviceId ORDER BY c.time DESC`,
      parameters: [{ name: "@deviceId", value: DEVICE_ID }],
    };

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    if (items.length === 0) {
      return res.status(404).json({ error: "No data found" });
    }

    const latestData = items[0];
    const flow = latestData.Flow1;

    // 現在の熱量計算 (供給温度差)
    const tempDiffCurrent = latestData.tempC2 - latestData.tempC3;
    const energyCurrent = calculateEnergy(tempDiffCurrent, flow);
    
    // 排熱回収装置の熱量計算
    const tempDiffRecovery = latestData.tempC4 - latestData.tempC3;
    const energyRecovery = calculateEnergy(tempDiffRecovery, flow);
    
    // コスト計算
    const costCurrent = calculateCost(energyCurrent);
    const costRecovery = calculateCost(energyRecovery);

    // 365日24時間運用時の年間コスト
    const yearlyCostCurrent = calculateCost(energyCurrent * 24 * 365);
    const yearlyCostRecovery = calculateCost(energyRecovery * 24 * 365);

    // 年間の熱量計算
    const yearlyEnergy = {
      "24 hours": (energyCurrent * 24).toFixed(2),
      "365 days": (energyCurrent * 24 * 365).toFixed(2),
    };

    res.status(200).json({
      device: DEVICE_ID,
      time: latestData.time,
      temperature: {
        supply1: latestData.tempC1,
        supply2: latestData.tempC2,
        discharge1: latestData.tempC3,
        discharge2: latestData.tempC4,
      },
      flow: latestData.Flow1,
      energy: {
        current: energyCurrent.toFixed(2),
        recovery: energyRecovery.toFixed(2),
        yearly: yearlyEnergy,
      },
      cost: {
        current: costCurrent,
        recovery: costRecovery,
        yearlyCurrent: yearlyCostCurrent,
        yearlyRecovery: yearlyCostRecovery,
      },
      unitCosts, // ✅ 単価情報を追加
    });
  } catch (error) {
    console.error("Error fetching realtime data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// ✅ **単価データの取得エンドポイント**
app.get("/api/unitCosts", (req, res) => {
  res.status(200).json({ unitCosts });
});

// サーバー動作確認エンドポイント
app.get("/", (req, res) => {
  res.status(200).json({ message: "Backend is running!" });
});
