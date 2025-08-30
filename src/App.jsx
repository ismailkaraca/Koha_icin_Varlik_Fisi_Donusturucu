import React, { useState, useCallback } from 'react';

// Bu uygulama, bir Excel dosyasını işlemek ve belirli bir şablona göre dönüştürmek için kullanılır.
// Gerekli kütüphanelerin (React, ReactDOM, SheetJS) ortam tarafından sağlandığı varsayılmaktadır.
const App = () => {
    const [sourceFile, setSourceFile] = useState(null);
    const [processedData, setProcessedData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');
    const [fileNamePrefix, setFileNamePrefix] = useState('');
    const [isDraggingOver, setIsDraggingOver] = useState(false); // Sürükleme durumu için state
    const [showInfo, setShowInfo] = useState(false); // Bilgilendirme panelinin görünürlüğü için state

    // Dosyayı state'e ayarlayan yardımcı fonksiyon
    const setFile = (file) => {
         if (file && (file.name.endsWith('.xls') || file.name.endsWith('.xlsx'))) {
            setSourceFile(file);
            setFileName(file.name);
            setError('');
        } else {
            setError('Lütfen sadece .xls veya .xlsx formatında bir dosya seçin.');
        }
    };

    // Dosya girişinden dosya seçimini yönetir
    const handleFileChange = useCallback((e) => {
        if (e.target.files && e.target.files[0]) {
           setFile(e.target.files[0]);
        }
    }, []);
    
    // Sürükle-bırak olaylarını yöneten fonksiyonlar
    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation(); // Bu, bırakma olayının tetiklenmesi için gereklidir
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData(); // Bırakılan veriyi temizle
        }
    }, []);

    // Yüklenen Excel dosyasını işler
    const processFile = useCallback(() => {
        if (!sourceFile) {
            setError('Lütfen "Varlık İşlem Fişi" dosyasını seçin.');
            return;
        }

        setIsLoading(true);
        setError('');
        setProcessedData([]);

        const reader = new FileReader();
        reader.onload = (e) => {
            const fileData = e.target.result;

            const runProcessing = () => {
                try {
                    const data = new Uint8Array(fileData);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = window.XLSX.utils.sheet_to_json(worksheet);

                    if (jsonData.length === 0) {
                        setError("Yüklenen dosyada veri bulunamadı.");
                        setIsLoading(false);
                        return;
                    }

                    // Kaynak dosyada gerekli sütunların olup olmadığını kontrol et
                    const requiredColumns = ['malzemeAdi', 'sicilNo', 'barKod', 'birimFiyat'];
                    const firstRow = jsonData[0];
                    const hasAllColumns = requiredColumns.every(col => col in firstRow);

                    if (!hasAllColumns) {
                        setError('Yüklenen dosya beklenen sütunları içermiyor (malzemeAdi, sicilNo, barKod, birimFiyat).');
                        setIsLoading(false);
                        return;
                    }

                    // Veriyi kullanıcı mantığına göre haritala ve dönüştür
                    const newData = jsonData.map(row => {
                        const malzemeAdi = row.malzemeAdi || '';
                        const parts = malzemeAdi.split('-');

                        const isbn = parts.length > 1 ? parts[parts.length - 1].trim() : '';
                        const eserAdi = parts.length > 2 ? parts[parts.length - 2].trim() : '';
                        
                        const fiyatStr = String(row.birimFiyat || '0').trim().replace(',', '.');
                        const fiyat = parseFloat(fiyatStr);

                        return {
                            'ISBN': isbn,
                            'ESER ADI': eserAdi,
                            'YAZAR AD SOYAD': '',
                            'YAYINEVİ': '',
                            'YAYIN YILI': '',
                            'BASIM SAYISI': '',
                            'TİF SİCİL NO': row.sicilNo || '',
                            'TİF BARKOD(KODU)': row.barKod || '',
                            'FİYAT': !isNaN(fiyat) ? fiyat.toFixed(2) : '0.00',
                        };
                    });

                    setProcessedData(newData);
                } catch (err) {
                    console.error("İşleme hatası:", err);
                    setError('Dosya işlenirken bir hata oluştu. Lütfen dosyanın bozuk olmadığını ve doğru formatta olduğunu kontrol edin.');
                } finally {
                    setIsLoading(false);
                }
            };

            // SheetJS kütüphanesinin yüklenip yüklenmediğini kontrol et
            if (typeof window.XLSX === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                document.head.appendChild(script);
                script.onload = () => {
                    runProcessing();
                };
                script.onerror = () => {
                    setError("Veri işleme kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.");
                    setIsLoading(false);
                }
            } else {
                runProcessing();
            }
        };

        reader.onerror = () => {
            setError('Dosya okunurken bir hata meydana geldi.');
            setIsLoading(false);
        };

        reader.readAsArrayBuffer(sourceFile);
    }, [sourceFile]);
    
    // İşlenmiş veriyi yeni bir Excel dosyası olarak indirmeyi yönetir
    const downloadExcel = useCallback(() => {
        if (processedData.length === 0) return;
        
        const worksheet = window.XLSX.utils.json_to_sheet(processedData);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "İşlenmiş Veri");

        // Daha iyi okunabilirlik için sütun genişliklerini ayarla
        const columnWidths = [
            { wch: 18 }, // ISBN
            { wch: 45 }, // ESER ADI
            { wch: 20 }, // YAZAR AD SOYAD
            { wch: 20 }, // YAYINEVİ
            { wch: 12 }, // YAYIN YILI
            { wch: 15 }, // BASIM SAYISI
            { wch: 28 }, // TİF SİCİL NO
            { wch: 28 }, // TİF BARKOD(KODU)
            { wch: 12 }, // FİYAT
        ];
        worksheet['!cols'] = columnWidths;

        // Tarih formatlama
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}-${day}-${month}`;

        // Dosya adı oluşturma
        const baseName = `Koha_icin_KBSden_Tif_Aktarma_Dosyasi_${dateString}`;
        const finalName = fileNamePrefix 
            ? `${fileNamePrefix}_${baseName}.xlsx` 
            : `${baseName}.xlsx`;

        window.XLSX.writeFile(workbook, finalName);
    }, [processedData, fileNamePrefix]);

    // Ana bileşenin render metodu
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 font-sans">
            <div className="w-full max-w-5xl mx-auto">
                <header className="text-center my-8">
                    <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">Varlık İşlem Fişini Koha Kütüphane Otomasyon Sistemi'ne Giriş İçin Excel'e Dönüştürme</h1>
                    <p className="mt-2 text-lg text-gray-600">Bu araç, "Varlık İşlem Fişi" dosyasını Koha sistemine uygun bir Excel formatına dönüştürür.</p>
                </header>

                <main>
                    {/* Bilgi Notu */}
                     <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-4 rounded-r-lg shadow-md mb-8" role="alert">
                        <div className="flex">
                            <div className="py-1">
                                <svg className="fill-current h-6 w-6 text-blue-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zM9 5v6h2V5H9zm0 8h2v-2H9v2z"/></svg>
                            </div>
                            <div>
                                <p className="font-bold">Kullanım Bilgisi</p>
                                <p className="text-sm">
                                    Burada oluşturulan dosyanın "Koha Kütüphane Otomasyon Sistemi"nde nasıl kullanılacağına dair bilgiye,  
                                    <a 
                                        href="https://drive.google.com/file/d/1-1lRqTQSUk3dcTwZsMXQi6kXK-kDdEty/view?usp=sharing" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="font-semibold underline hover:text-blue-900"
                                    >
                                        "Genel Kullanım Kılavuzu"
                                    </a>  
                                    içindeki "KBS Taşınır Kayıt ve Yönetim Sisteminden Veri Aktarma İşlemleri" başlığından ulaşabilirsiniz.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bilgilendirme Paneli */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 mb-8">
                        <button
                            onClick={() => setShowInfo(!showInfo)}
                            className="w-full text-left text-lg font-semibold text-gray-700 flex justify-between items-center transition-colors duration-300 hover:text-blue-600"
                        >
                            Uygulama Hakkında Önemli Bilgiler ve Uyarılar
                            <svg className={`w-5 h-5 transition-transform duration-300 ${showInfo ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        {showInfo && (
                            <div className="mt-4 text-gray-600 space-y-4 border-t pt-4">
                                <p>Bu uygulama TKYS'den indirilen Varlık İşlem Fişi (VİF) - [Eski adıyla TİF] dosyasının Koha'ya aktarılacak formatını otomatik oluşturmaya yaramaktadır. Ancak bu işlemin tam anlamıyla çalışabilmesi için TKYS sistemine şablon ile veya tek tek yapılan tüm veri girişlerinde, "Özel Kod/Modeli" alanına kitabın ISBN bilgisinin kesinlikle girilmesi gerekmekte, TKYS'den dışarı aktarılan dosyanın da malzemeAdi alanının sonunda ISBN verisinin (KARMA DİĞER KİTAPLAR-.MARKASIZ-Kelebek Zihinli Çocuk-9786050837933) örneğindeki gibi olması gerekmektedir. Bu bilginin eksik veya yanlış girilmesi durumunda dönüştürme işleminin işlevsiz kalacağı bilinmelidir.</p>
                                
                                <h3 className="text-md font-semibold text-gray-800 pt-2">KBS'den TİF Aktarım Modülü Hakkında</h3>
                                <p>KBS'den TİF Aktar ve İçeri Aktarılan TİF'lerim modülü, KBS Programına eklenmiş ve onaylanmış materyallerin, Koha programına kontrollü olarak kaydedilmesi konusunda kolaylık sağlamak amacıyla tercihen kullanılabilecek modüldür.</p>
                                
                                <ul className="list-disc list-inside space-y-3">
                                    <li>KBS’den excel olarak indirilecek (TİFler) listeler, “KBS’den TİF Aktar”alanında belirtilen “İçeri Aktarılacak Excel Dosyası Düzeni”ne göre düzenlenir. KBS TİF’inde karşılığı olmayan sütunlar boş olarak muhafaza edilir.</li>
                                     <li>
                                        <strong className="text-yellow-600 font-semibold">NOT:</strong> “TİF sicil no” sütununun boş olması halinde işlem gerçekleşmez.
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Adım 1: Dosya Yükleme */}
                    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">1. Adım: Dosyanızı Yükleyin</h2>
                        <p className="text-gray-500 mb-4">Lütfen işlemek istediğiniz "Varlık İşlem Fişi.xls" veya ".xlsx" dosyasını seçin.</p>
                        
                        <label 
                            htmlFor="file-upload" 
                            className={`cursor-pointer mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors duration-300 ${isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            <div className="space-y-1 text-center">
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="flex text-sm text-gray-600 justify-center">
                                    <p className="pl-1">{fileName ? `Seçilen dosya: ${fileName}` : 'Dosya seçmek için tıklayın veya sürükleyip bırakın'}</p>
                                </div>
                                <p className="text-xs text-gray-500">XLS, XLSX formatında</p>
                            </div>
                        </label>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xls,.xlsx" onChange={handleFileChange} />

                        {/* Adım 2: İşlem Düğmesi */}
                        <div className="mt-6 text-center">
                            <button
                                onClick={processFile}
                                disabled={!sourceFile || isLoading}
                                className="w-full sm:w-auto inline-flex justify-center items-center px-10 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        İşleniyor...
                                    </>
                                ) : '2. Adım: Verileri İşle ve Dönüştür'}
                            </button>
                        </div>
                        {error && <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">{error}</div>}
                    </div>
                    
                    {/* Adım 3: Sonuçlar ve İndirme */}
                    {processedData.length > 0 && (
                        <div className="mt-10 bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">3. Adım: Sonuçları İndirin</h2>
                                    <p className="text-gray-600 mt-1">Dönüştürülen veriler aşağıda listelenmiştir. Tam listeyi Excel olarak indirebilirsiniz.</p>
                                </div>
                                <button
                                    onClick={downloadExcel}
                                    className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-300 transform hover:scale-105"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    Excel Olarak İndir
                                </button>
                            </div>
                             
                            <div className="mb-6">
                                <label htmlFor="file-prefix" className="block text-sm font-medium text-gray-700 mb-1">
                                    Dosya Adı Ön Eki (İsteğe Bağlı)
                                </label>
                                <input
                                    type="text"
                                    id="file-prefix"
                                    value={fileNamePrefix}
                                    onChange={(e) => setFileNamePrefix(e.target.value)}
                                    placeholder="Örn: Yetişkin"
                                    className="mt-1 block w-full sm:w-1/2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                                />
                            </div>

                            <div className="overflow-x-auto rounded-lg border">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {processedData.length > 0 && Object.keys(processedData[0]).map(key => (
                                                <th key={key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {processedData.slice(0, 50).map((row, index) => ( // Önizleme için ilk 50 satırı göster
                                            <tr key={index} className="hover:bg-gray-50 transition-colors">
                                                {Object.values(row).map((value, i) => (
                                                    <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">{value}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {processedData.length > 50 && <p className="text-sm text-center text-gray-500 mt-4">Tabloda ilk 50 satır gösterilmektedir. Tüm veriler Excel dosyasına aktarılacaktır.</p>}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;


