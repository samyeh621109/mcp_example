'use client';

import { useState } from 'react';
import { Bar, Scatter, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// 確保所有必要的組件都已註冊
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend
);

interface AnalysisResult {
  prompts: { stage: string; prompt: string }[];
  intermediateResults: { stage: string; result: any }[];
  reportData: {
    總結: string;
    重點見解: string[];
    建議: { 建議: string; 步驟: string[] }[];
    策略影響: string;
    未來機會: string;
  };
  chartData: {
    regionSales: { labels: string[]; values: number[] };
    productSales: { labels: string[]; values: number[] };
    scatterData: { datasets: { label: string; data: { x: string; y: number; size: number }[] }[] };
    timeSeries: { labels: string[]; datasets: { label: string; data: number[] }[] };
  };
}

// 圖表可視化組件
function ChartVisualization({ chartData }: { chartData: AnalysisResult['chartData'] }) {
  // 檢查是否有圖表數據
  if (!chartData) return <div className="text-center p-4">尚無可視化數據</div>;
  
  // 設置圖表主題顏色
  const colors = {
    bar1: 'rgba(75, 192, 192, 0.6)',
    bar1Border: 'rgba(75, 192, 192, 1)',
    bar2: 'rgba(153, 102, 255, 0.6)',
    bar2Border: 'rgba(153, 102, 255, 1)',
    line: [
      'rgba(255, 99, 132, 1)',
      'rgba(54, 162, 235, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
    ],
    scatter: [
      'rgba(255, 99, 132, 0.7)',
      'rgba(54, 162, 235, 0.7)',
      'rgba(255, 206, 86, 0.7)',
      'rgba(75, 192, 192, 0.7)',
      'rgba(153, 102, 255, 0.7)',
      'rgba(255, 159, 64, 0.7)',
    ]
  };

  // 處理散點圖數據集，確保每個區域有唯一顏色
  const enhancedScatterDatasets = chartData.scatterData.datasets.map((dataset, index) => ({
    ...dataset,
    backgroundColor: colors.scatter[index % colors.scatter.length],
    borderColor: colors.scatter[index % colors.scatter.length].replace('0.7', '1'),
    borderWidth: 1,
    pointRadius: dataset.data.map(point => Math.max(5, Math.min(15, point.size || 5))),
    pointHoverRadius: dataset.data.map(point => Math.max(7, Math.min(20, (point.size || 5) + 2))),
  }));
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h4 className="text-md font-semibold mb-2">各區域總銷售額</h4>
        <div className="h-64">
          <Bar
            data={{
              labels: chartData.regionSales.labels,
              datasets: [{
                label: '銷售額',
                data: chartData.regionSales.values,
                backgroundColor: colors.bar1,
                borderColor: colors.bar1Border,
                borderWidth: 1,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { 
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => `銷售額: ${context.parsed.y.toLocaleString()} 元`
                  }
                }
              },
              scales: {
                y: { 
                  title: { display: true, text: '銷售額' },
                  ticks: {
                    callback: (value) => {
                      if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value/1000).toFixed(0)}K`;
                      return value;
                    }
                  }
                }
              },
            }}
          />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h4 className="text-md font-semibold mb-2">各產品總銷售額</h4>
        <div className="h-64">
          <Bar
            data={{
              labels: chartData.productSales.labels,
              datasets: [{
                label: '銷售額',
                data: chartData.productSales.values,
                backgroundColor: colors.bar2,
                borderColor: colors.bar2Border,
                borderWidth: 1,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { 
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => `銷售額: ${context.parsed.y.toLocaleString()} 元`
                  }
                }
              },
              scales: {
                y: { 
                  title: { display: true, text: '銷售額' },
                  ticks: {
                    callback: (value) => {
                      if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value/1000).toFixed(0)}K`;
                      return value;
                    }
                  }
                }
              },
            }}
          />
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <h4 className="text-md font-semibold mb-2">產品銷售額分布 (按區域)</h4>
        <div className="h-64">
          <Scatter
            data={{ datasets: enhancedScatterDatasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { boxWidth: 12, usePointStyle: true }
                },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const point = context.raw;
                      return `${context.dataset.label}: ${point.x} - ${point.y.toLocaleString()} 元`;
                    }
                  }
                }
              },
              scales: {
                x: {
                  type: 'category',
                  title: { display: true, text: '產品' },
                  grid: { display: false },
                  ticks: { autoSkip: false, maxRotation: 45 }
                },
                y: {
                  title: { display: true, text: '銷售額' },
                  ticks: {
                    callback: (value) => {
                      if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value/1000).toFixed(0)}K`;
                      return value;
                    }
                  }
                }
              },
              animation: {
                duration: 1000,
                easing: 'easeOutQuart'
              }
            }}
          />
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <h4 className="text-md font-semibold mb-2">銷售額時間趨勢</h4>
        <div className="h-64">
          <Line
            data={{
              labels: chartData.timeSeries.labels,
              datasets: chartData.timeSeries.datasets.map((dataset, index) => ({
                ...dataset,
                borderColor: colors.line[index % colors.line.length],
                backgroundColor: colors.line[index % colors.line.length].replace('1)', '0.1)'),
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.4
              })),
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { boxWidth: 12 }
                },
                tooltip: {
                  mode: 'index',
                  intersect: false,
                  callbacks: {
                    label: (context) => `${context.dataset.label}: ${context.parsed.y.toLocaleString()} 元`
                  }
                }
              },
              scales: {
                x: { 
                  title: { display: true, text: '日期' },
                  grid: { display: false }
                },
                y: { 
                  title: { display: true, text: '銷售額' },
                  ticks: {
                    callback: (value) => {
                      if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value/1000).toFixed(0)}K`;
                      return value;
                    }
                  }
                }
              },
              interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

// 主頁面組件
export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setAnalysisResult(null);
      setErrorMessage('');
    }
  };

  const handleAnalyzeClick = async () => {
    if (!selectedFile) {
      setErrorMessage('請先選擇一個 Excel 檔案。');
      return;
    }

    setLoading(true);
    setAnalysisResult(null);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrorMessage(errorData?.error || '分析失敗，請檢查伺服器日誌或 API 配額。');
        console.error('Analysis API error:', errorData);
      } else {
        const result = await response.json();
        setAnalysisResult(result);
      }
    } catch (error: any) {
      setErrorMessage(`分析過程中發生錯誤：${error.message}`);
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">MCP 銷售數據分析</h1>
      <div className="mb-4">
        <label htmlFor="excelFile" className="block text-gray-700 text-sm font-bold mb-2">
          選擇 Excel 檔案:
        </label>
        <input
          type="file"
          id="excelFile"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          onChange={handleFileChange}
          accept=".xlsx, .xls"
        />
      </div>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
        onClick={handleAnalyzeClick}
        disabled={!selectedFile || loading}
      >
        {loading ? '分析中...' : '開始分析'}
      </button>

      {errorMessage && (
        <div className="mt-4 text-red-500 font-semibold">{errorMessage}</div>
      )}

      {analysisResult && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">分析報告</h2>
          
          {/* 圖表區域 */}
          {analysisResult.chartData && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2">銷售數據視覺化</h3>
              <ChartVisualization chartData={analysisResult.chartData} />
            </div>
          )}
          
          {/* 報告區域 */}
          <div className="border p-4 rounded shadow-md bg-gray-100">
            <h3 className="text-lg font-semibold">總結</h3>
            <p className="mb-4">{analysisResult.reportData.總結}</p>

            <h3 className="text-lg font-semibold">重點見解</h3>
            <ul className="list-disc pl-5 mb-4">
              {analysisResult.reportData.重點見解.map((insight, index) => (
                <li key={index}>{insight}</li>
              ))}
            </ul>

            <h3 className="text-lg font-semibold">行動建議</h3>
            <ul className="list-disc pl-5 mb-4">
              {analysisResult.reportData.建議.map((rec, index) => (
                <li key={index}>
                  {rec.建議}
                  <div className="ml-4 mt-2">
                    <strong>實施步驟：</strong>
                    <ol className="list-decimal pl-5">
                      {rec.步驟.map((step, stepIndex) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="text-lg font-semibold">策略影響</h3>
            <p className="mb-4">{analysisResult.reportData.策略影響}</p>

            <h3 className="text-lg font-semibold">未來機會</h3>
            <p className="mb-4">{analysisResult.reportData.未來機會}</p>
          </div>
          
          {/* 推理過程區域 */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">分析推理過程</h2>
            <div className="space-y-4">
              {analysisResult.prompts.map((item, index) => (
                <div key={index} className="border p-4 rounded shadow-md bg-gray-100">
                  <h3 className="text-lg font-semibold">{item.stage} 提示詞:</h3>
                  <pre className="whitespace-pre-wrap text-sm mt-2 p-2 bg-white rounded">
                    {item.prompt.slice(0, 500) + (item.prompt.length > 500 ? '...' : '')}
                  </pre>
                  <h3 className="text-lg font-semibold mt-4">{item.stage} 結果:</h3>
                  <pre className="whitespace-pre-wrap text-sm mt-2 p-2 bg-white rounded">
                    {JSON.stringify(analysisResult.intermediateResults[index]?.result, null, 2).slice(0, 500) + 
                     (JSON.stringify(analysisResult.intermediateResults[index]?.result, null, 2).length > 500 ? '...' : '')}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}