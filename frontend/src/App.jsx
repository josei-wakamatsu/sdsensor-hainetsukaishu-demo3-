import React, { useState, useEffect } from "react";
import axios from "axios";

const backendUrl = "https://sdsensor-hainetsukaishu-demo3-backend.onrender.com";

const App = () => {
  const [flow1, setFlow1] = useState(10);
  const [costType, setCostType] = useState("プロパンガス");
  const [costUnit, setCostUnit] = useState(30);
  const [operatingHours, setOperatingHours] = useState(8);
  const [operatingDays, setOperatingDays] = useState(365);
  const [realTimeData, setRealTimeData] = useState(null);
  const [calculatedData, setCalculatedData] = useState(null);
  const [error, setError] = useState(null);

  const temperatureLabels = {
    tempC1: "給水IN",
    tempC2: "給水OUT",
    tempC4: "排水IN",
    tempC3: "排水OUT",
  };
  

  

  const costUnitLabel = costType === "電気" ? "円/kWh" : "円/kg";

  const fetchRealTimeData = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/realtime`);
      console.log("サーバーからのレスポンス:", response.data);
      setRealTimeData(response.data);
    } catch (error) {
      console.error("エラー:", error);
    }
  };

  useEffect(() => {
    fetchRealTimeData();
    const interval = setInterval(fetchRealTimeData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchCalculation = async () => {
    await fetchRealTimeData();
    if (!realTimeData) {
      setError("リアルタイムデータが取得できていません");
      return;
    }

    try {
      const response = await axios.post(`${backendUrl}/api/calculate`, {
        flow: flow1,
        costType,
        costUnit,
        operatingHours,
        operatingDays,
        temperature: realTimeData.temperature,
      });
      console.log("計算結果:", response.data);
      setCalculatedData(response.data);
    } catch (error) {
      console.error("計算エラー:", error);
      setError("計算に失敗しました");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-white p-6">
      <h1 className="text-2xl font-bold text-center mb-6">排熱回収装置</h1>

 {/* ✅ リアルタイム温度データ */}
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-6xl mb-6">
  {["tempC1", "tempC2", "tempC4", "tempC3"].map((key) => {
    const value = realTimeData?.temperature?.[key]; // 指定順に値を取得
    const bgColor = key.includes("tempC1") || key.includes("tempC2") ? "bg-blue-200" : "bg-orange-200"; // 給水=青、排水=オレンジ

    return (
      <div key={key} className={`p-6 rounded-lg shadow-md flex flex-col items-center ${bgColor}`}>
        <h2 className="text-lg font-semibold text-gray-800 text-center mb-2">
          {temperatureLabels[key] ?? key}
        </h2>
        <p className="text-xl font-bold">{value !== undefined ? `${value.toFixed(2)} °C` : "データなし"}</p>
      </div>
    );
  })}
</div>


      {/* ✅ 入力フォーム (レスポンシブ対応) */}
      <div className="bg-gray-100 p-6 rounded-lg shadow-md grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-6xl mb-6">
        <div className="flex flex-col items-center">
          <label className="mb-2 font-semibold">流量 (L/min)</label>
          <input type="number" value={flow1 || ""} onChange={(e) => setFlow1(parseFloat(e.target.value) || 0)}
            className="border border-gray-400 p-2 rounded w-full text-center" />
        </div>

        <div className="flex flex-col items-center">
          <label className="mb-2 font-semibold">コスト種類</label>
          <select value={costType} onChange={(e) => setCostType(e.target.value)}
            className="border border-gray-400 p-2 rounded w-full text-center">
            <option value="電気">電気</option>
            <option value="プロパンガス">プロパンガス</option>
            <option value="灯油">灯油</option>
            <option value="重油">重油</option>
            <option value="ガス(13A)">ガス(13A)</option>
          </select>
        </div>

        <div className="flex flex-col items-center">
          <label className="mb-2 font-semibold">コスト単価 ({costUnitLabel})</label>
          <input type="number" value={costUnit || ""} onChange={(e) => setCostUnit(parseFloat(e.target.value) || 0)}
            className="border border-gray-400 p-2 rounded w-full text-center" />
        </div>

        <div className="flex flex-col items-center">
          <label className="mb-2 font-semibold">稼働時間 (h/日)</label>
          <input type="number" value={operatingHours || ""} onChange={(e) => setOperatingHours(parseFloat(e.target.value) || 0)}
            className="border border-gray-400 p-2 rounded w-full text-center" />
        </div>

        <div className="flex flex-col items-center">
          <label className="mb-2 font-semibold">稼働日数 (日/年)</label>
          <input type="number" value={operatingDays || ""} onChange={(e) => setOperatingDays(parseFloat(e.target.value) || 0)}
            className="border border-gray-400 p-2 rounded w-full text-center" />
        </div>

        <button onClick={fetchCalculation} className="bg-blue-500 text-white py-2 px-6 rounded-md shadow-md sm:col-span-2 md:col-span-3">
          計算
        </button>
      </div>

      {/* ✅ 計算結果 */}
      {calculatedData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-6xl">
          <div className="bg-gray-100 p-6 rounded-lg shadow-md flex flex-col items-center border border-black">
            <h2 className="text-lg font-semibold">現状のコスト</h2>
            <p className="text-3xl font-bold">{calculatedData.currentCost} 円/h</p>
            <p className="text-3xl font-bold">{calculatedData.yearlyCost} 円/年</p>
          </div>

          <div className="bg-gray-100 p-6 rounded-lg shadow-md flex flex-col items-center border border-black">
            <h2 className="text-lg font-semibold">排熱回収装置によるコストメリット</h2>
            <p className="text-3xl font-bold">{calculatedData.recoveryBenefit} 円/h</p>
            <p className="text-3xl font-bold">{calculatedData.yearlyRecoveryBenefit} 円/年</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
