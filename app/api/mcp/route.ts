import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// MCP context interface
interface MCPContext {
  context: {
    task: string;
    data_source: string;
    schema: {
      inferred: boolean;
      fields: string[];
    };
  };
  thinking: Record<string, any>;
  results: Record<string, any>;
}

// Helper to convert Excel data to JSON
async function excelToJson(buffer: ArrayBuffer): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  const stream = new Readable();
  stream.push(Buffer.from(buffer));
  stream.push(null);

  try {
    await workbook.xlsx.read(stream);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error('無工作表');

    const rows: any[] = [];
    const headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          headers.push(cell.value?.toString() || '');
        });
      } else {
        const rowData: Record<string, any> = {};
        row.eachCell((cell, colNumber) => {
          if (colNumber <= headers.length) {
            rowData[headers[colNumber - 1]] = cell.value;
          }
        });
        rows.push(rowData);
      }
    });

    return rows;
  } catch (error: any) {
    console.error('Excel parsing error:', error);
    throw new Error(`Excel 檔案解析失敗：${error.message}`);
  }
}

// Convert JSON data to string for prompts
function jsonToString(data: any[]): string {
  const maxRows = 20;
  const maxCols = 10;
  const limitedData = data.slice(0, maxRows).map(row => {
    const limitedRow: Record<string, any> = {};
    Object.keys(row).slice(0, maxCols).forEach(key => {
      limitedRow[key] = row[key];
    });
    return limitedRow;
  });
  return JSON.stringify(limitedData, null, 2);
}

// MCP prompt functions
function createRolePrompt(roleDescription: string): string {
  return `
    # 角色扮演指導

    您現在是一位專業的${roleDescription}。您的任務是提供深入、專業且有洞察力的分析。
    - 請使用專業的語言和術語
    - 聚焦重點數據的變化趨勢與模式
    - 提供具有實用性的見解和建議
    - 確保您的分析具有邏輯性和可行性
    - 請確保所有回應使用繁體中文，所有標籤和字段名稱也必須使用繁體中文

    請基於以下資訊進行您的專業分析：
  `;
}

function createDataUnderstandingPrompt(data: any[], mcpContext: MCPContext): string {
  const rolePrefix = createRolePrompt('數據分析師');
  const dataStr = jsonToString(data);

  return `${rolePrefix}
    # 數據理解階段

    我將為您提供銷售數據，請分析這些數據並更新MCP上下文。
    請特別聚焦數據模式、趨勢和可能的異常。
    請確保所有回應和分析結果使用繁體中文，包括所有JSON字段名稱也需使用繁體中文。

    ## 銷售數據 (前幾行展示):
    ${dataStr}

    ## 目前MCP上下文:
    ${JSON.stringify(mcpContext, null, 2)}

    請分析數據並更新"thinking"部分，增加以下內容:
    1. 數據模式: 識別數據中的主要模式和特徵
    2. 異常值: 識別可能的異常值或不尋常模式
    3. 數據質量: 評估數據的完整性和可靠性
    4. 基礎統計: 提供基本統計數據(如平均銷售額、最高/最低銷售記錄等)

    請僅返回更新後的完整MCP JSON結構，不要增加其他解釋。
    請確保所有字段名稱使用繁體中文，如"數據模式"而非"data_patterns"。
  `;
}

function createAnalysisPrompt(mcpContext: MCPContext): string {
  const rolePrefix = createRolePrompt('銷售策略分析顧問');

  return `${rolePrefix}
    # 分析推理階段

    基於前面的數據理解，現在進行深入分析。
    請確保所有回應和分析結果使用繁體中文，包括所有JSON字段名稱也需使用繁體中文。

    ## 目前MCP上下文:
    ${JSON.stringify(mcpContext, null, 2)}

    請在"thinking"部分增加以下分析:
    1. 區域分析: 各區域的銷售表現分析，包括強勢和弱勢區域
    2. 產品表現: 各產品的銷售表現分析，包括銷售趨勢和潛力
    3. 客戶洞察: 不同客戶群體的購買行為分析
    4. 相關性分析: 分析產品、區域和客戶類型之間的相關性
    5. 時間序列見解: 識別時間序列中的趨勢和季節性模式

    請確保所有字段名稱使用繁體中文，如"區域分析"而非"regional_analysis"。

    請僅返回更新後的完整MCP JSON結構，不要增加其他解釋。
  `;
}

function createResultGenerationPrompt(mcpContext: MCPContext): string {
  const rolePrefix = createRolePrompt('商業策略顧問');

  return `${rolePrefix}
    # 結果產生階段

    根據前面的分析，現在產生最終結果和建議。
    請確保所有回應和分析結果使用繁體中文，包括所有JSON字段名稱和內容都必須使用繁體中文。

    ## 目前MCP上下文:
    ${JSON.stringify(mcpContext, null, 2)}

    請在"results"部分增加以下內容，全部使用繁體中文:
    1. 重點見解: 3-5個重點見解，按重要性排序
    2. 建議: 3-5個具體建議，每個建議應包含實施步驟
    3. 策略影響: 這些發現對業務策略的影響
    4. 未來機會: 基於數據識別的未來增長機會
    5. 總結: 整體分析總結(200字以內)

    請確保結果基於前面的分析數據，並提供具體的行動建議。
    每個建議應該是一個含有「建議」和「步驟」兩個子鍵的物件，其中「步驟」是一個列表，包含具體的實施步驟。

    請僅返回更新後的完整MCP JSON結構，不要增加其他解釋。
    確保所有字段名稱和內容都使用繁體中文，不使用英文或拼音。
  `;
}

// Call Gemini API (使用官方套件進行重構)
async function processWithGemini(prompt: string, stage: string): Promise<MCPContext | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('未提供 Google Gemini API 密鑰，請在 .env.local 中設置 GEMINI_API_KEY');
  }

  console.log(`開始處理 ${stage} 階段...`);

  try {
    // 1. 初始化 Generative Model
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' }); // 指定模型為 gemini-2.0-flash

    // 2. 設定生成配置
    const generationConfig = {
      temperature: 0.2,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    };

    // 3. 設定安全設定
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    // 4. 發送請求
    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    const response = result.response;
    const resultText = response.text(); // 獲取回應文本

    if (resultText === undefined || resultText === null) {
      console.error('Gemini API Response Structure:', JSON.stringify(response.candidates, null, 2));
      throw new Error('Gemini API 未返回有效的回應內容');
    }

    // 5. 處理可能包含在 ```json ... ``` 中的 JSON
    let jsonString = resultText.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.substring(7);
      if (jsonString.endsWith('```')) {
        jsonString = jsonString.substring(0, jsonString.length - 3);
      }
      jsonString = jsonString.trim();
    } else if (jsonString.startsWith('{') && jsonString.endsWith('}')) {
      // 假設是純 JSON
    } else {
      const jsonMatch = jsonString.match(/(\{[\s\S]*\})/);
      if (!jsonMatch) {
        console.error('無法從回應中提取 JSON:', jsonString.slice(0, 500));
        throw new Error('Gemini 回應未包含可辨識的 JSON 結構');
      }
      jsonString = jsonMatch[1];
    }

    try {
      const parsedJson = JSON.parse(jsonString);
      console.log(`${stage} 階段成功完成`);
      return parsedJson;
    } catch (error: any) {
      console.error('JSON 解析錯誤:', error.message, '原始字串:', jsonString.slice(0, 500));
      throw new Error(`JSON 解析失敗：${error.message}`);
    }
  } catch (error: any) {
    console.error(`處理 ${stage} 階段失敗:`, error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(String(error));
    }
  }
}

// Prepare chart data
function prepareChartData(data: any[]) {
  const regionSales: Record<string, number> = {};
  const productSales: Record<string, number> = {};
  const scatterData: { [region: string]: { product: string; sales: number }[] } = {};
  const timeSeries: { [date: string]: { [product: string]: number } } = {};

  data.forEach(row => {
    if (row.區域 && row.銷售額) {
      regionSales[row.區域] = (regionSales[row.區域] || 0) + Number(row.銷售額);
    }
    if (row.產品 && row.銷售額) {
      productSales[row.產品] = (productSales[row.產品] || 0) + Number(row.銷售額);
    }
    if (row.產品 && row.區域 && row.銷售額) {
      scatterData[row.區域] = scatterData[row.區域] || [];
      scatterData[row.區域].push({ product: row.產品, sales: Number(row.銷售額) });
    }
    if (row.日期 && row.產品 && row.銷售額) {
      const date = new Date(row.日期).toISOString().split('T')[0];
      timeSeries[date] = timeSeries[date] || {};
      timeSeries[date][row.產品] = (timeSeries[date][row.產品] || 0) + Number(row.銷售額);
    }
  });

  const scatterDatasets = Object.keys(scatterData).map(region => ({
    label: region,
    data: scatterData[region].map(item => ({
      x: item.product,
      y: item.sales,
      size: item.sales / 1000,
    })),
    backgroundColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.5)`,
  }));

  const timeSeriesLabels = Object.keys(timeSeries).sort();
  const timeSeriesDatasets = Object.keys(productSales).map(product => ({
    label: product,
    data: timeSeriesLabels.map(date => timeSeries[date][product] || 0),
    borderColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 1)`,
    fill: false,
  }));

  return {
    regionSales: {
      labels: Object.keys(regionSales),
      values: Object.values(regionSales),
    },
    productSales: {
      labels: Object.keys(productSales),
      values: Object.values(productSales),
    },
    scatterData: { datasets: scatterDatasets },
    timeSeries: { labels: timeSeriesLabels, datasets: timeSeriesDatasets },
  };
}

// API Route Handler
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '未提供Excel文件' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const data = await excelToJson(buffer);
    console.log('Excel data parsed:', data.slice(0, 5));

    const mcpContext: MCPContext = {
      context: {
        task: 'sales_analysis',
        data_source: 'excel_file',
        schema: { inferred: true, fields: ['日期', '產品', '區域', '銷售額', '客戶'] },
      },
      thinking: {},
      results: {},
    };

    const stages = ['數據理解', '分析推理', '結果產生'];
    const prompts: { stage: string; prompt: string }[] = [];
    const intermediateResults: { stage: string; result: any }[] = [];
    let currentContext = mcpContext;

    for (const stage of stages) {
      let prompt: string;
      if (stage === '數據理解') {
        prompt = createDataUnderstandingPrompt(data, currentContext);
      } else if (stage === '分析推理') {
        prompt = createAnalysisPrompt(currentContext);
      } else {
        prompt = createResultGenerationPrompt(currentContext);
      }
      prompts.push({ stage, prompt });

      const result = await processWithGemini(prompt, stage);
      if (!result) {
        throw new Error(`${stage} 階段未返回有效結果`);
      }
      currentContext = result;
      intermediateResults.push({ stage, result });
      console.log(`${stage} completed`);
    }

    const chartData = prepareChartData(data);
    const reportData = currentContext.results;

    return NextResponse.json({
      prompts,
      intermediateResults,
      reportData,
      chartData,
    }, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: error.message || '伺服器錯誤' }, { status: 500 });
  }
}
