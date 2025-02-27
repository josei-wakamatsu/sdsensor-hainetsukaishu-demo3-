const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3089;

const endpoint = process.env.COSMOSDB_ENDPOINT;
const key = process.env.COSMOSDB_KEY;
const client = new CosmosClient({ endpoint, key });
const databaseId = process.env.DATABASE_ID;
const containerId = process.env.CONTAINER_ID;

app.use(cors());
app.use(express.json());

const DEVICE_ID = "hainetsukaishu-demo3";

// ✅ **修正後の熱量計算関数**
function calculateEnergy(tempDiff, flow) {
  const specificHeat = 4.186; // 水の比熱 (kJ/kg・℃)
  const density = 1000; // 水の密度 (kg/m³)

  // kJ の計算 (×10^-3 を追加)
  const energy_kJ = tempDiff * flow * density * specificHeat * 1e-6; //1e-6は流量の単位変換と熱量の式の二つの結果

  // kJ → kW 変換 (0.278 × 60)
  const energy_kW = energy_kJ * 0.278 * 60;

  // kg/h の計算 (kW / 2257 × 3600)
  const massFlowRate_kg_per_h = (energy_kW / 2257) * 3600;

  return {
    energy_kJ: energy_kJ.toFixed(2),  // kJ 単位
    energy_kW: energy_kW.toFixed(2),  // kW 単位
    massFlowRate_kg_per_h: massFlowRate_kg_per_h.toFixed(2) // kg/h
  };
}


// **コスト計算関数**
function calculateCost(energyData, costType, costUnit) {
  let cost = 0;

  if (costType === "電気") {
    // 電気の場合 kW を使用
    cost = energyData.energy_kW * costUnit;
  } else {
    // 燃料の場合 kg/h を使用
    cost = energyData.massFlowRate_kg_per_h * costUnit;
  }

  return { cost: cost.toFixed(2) };
}

// **リアルタイムデータ取得**
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
      return res.status(500).json({ error: "Azure からデータを取得できませんでした" });
    }

    const latestData = items[0];

    res.status(200).json({
      temperature: {
        tempC1: latestData.tempC1,
        tempC2: latestData.tempC2,
        tempC3: latestData.tempC3,
        tempC4: latestData.tempC4,
      },
      flow: latestData.Flow1, // ✅ Flow1 も取得
    });
  } catch (error) {
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});
// **計算エンドポイント**
app.post("/api/calculate", async (req, res) => {
  try {
    console.log("✅ 受信データ: ", req.body);

    const { flow, costType, costUnit, operatingHours, operatingDays } = req.body; // ✅ Flow1 を受け取る

    // ✅ Azure から温度データを取得
    const database = client.database(databaseId);
    const container = database.container(containerId);
    const querySpec = {
      query: `SELECT TOP 1 * FROM c WHERE c.device = @deviceId ORDER BY c.time DESC`,
      parameters: [{ name: "@deviceId", value: DEVICE_ID }],
    };
    const { resources: items } = await container.items.query(querySpec).fetchAll();

    if (items.length === 0) {
      return res.status(500).json({ error: "Azure からデータを取得できませんでした" });
    }

    const latestData = items[0];

    // ✅ 温度データの取得
    const tempC1 = latestData.tempC1;
    const tempC2 = latestData.tempC2;
    const tempC3 = latestData.tempC3;
    const tempC4 = latestData.tempC4;

    console.log("✅ 取得した温度データ: ", { tempC1, tempC2, tempC3, tempC4 });

    // ✅ 熱量計算 (Flow1 をフロントエンドから取得)
    const energyCurrent = calculateEnergy(tempC4 - tempC1, flow);
    const energyRecovery = calculateEnergy(tempC2 - tempC1, flow);

    // ✅ コスト計算
    const currentCost = calculateCost(energyCurrent, costType, costUnit);
    const recoveryBenefit = calculateCost(energyRecovery, costType, costUnit);

    // ✅ 年間コスト計算
    const yearlyCost = (parseFloat(currentCost.cost) * operatingHours * operatingDays).toFixed(2);
    const yearlyRecoveryBenefit = (parseFloat(recoveryBenefit.cost) * operatingHours * operatingDays).toFixed(2);

    res.status(200).json({
      currentCost: currentCost.cost,
      yearlyCost,
      recoveryBenefit: recoveryBenefit.cost,
      yearlyRecoveryBenefit,
    });
  } catch (error) {
    console.error("❌ 計算エラー:", error);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ サーバー起動: http://localhost:${PORT}`);
});
