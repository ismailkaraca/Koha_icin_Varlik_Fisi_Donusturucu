import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function App() {
  const [file, setFile] = useState(null);
  const [processedData, setProcessedData] = useState([]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
    }
  };

  const processFile = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const [headers, ...rows] = jsonData;
      const processed = rows.map((row) => {
        const obj = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx] || '';
        });
        return obj;
      });
      setProcessedData(processed);
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(processedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Sheet1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, 'processedData.xlsx');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Varlık Fışi Dönüştürücü</h1>
      <div className="mb-4 flex items-center">
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileChange}
          className="border p-2"
        />
        <button
          onClick={processFile}
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Verileri İşle
        </button>
        {processedData.length > 0 && (
          <button
            onClick={downloadExcel}
            className="ml-2 px-4 py-2 bg-green-500 text-white rounded"
          >
            Excel'e Aktar
          </button>
        )}
      </div>
      {processedData.length > 0 && (
        <table className="table-auto w-full border-collapse">
          <thead>
            <tr>
              {Object.keys(processedData[0]).map((key) => (
                <th
                  key={key}
                  className="border px-4 py-2 text-left bg-gray-100"
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedData.map((row, index) => (
              <tr key={index} className="odd:bg-white even:bg-gray-50">
                {Object.keys(row).map((key) => (
                  <td key={key} className="border px-4 py-2">
                    {row[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
