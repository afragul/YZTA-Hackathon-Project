import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Mail, RefreshCw, X, Copy, ExternalLink, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';

type AiStockSuggestion = {
  product_id: number;
  sku: string;
  product_name: string;
  category: string | null;
  current_stock: number;
  low_stock_threshold: number;
  daily_average_sales: number;
  lead_time_days: number;
  days_until_out_of_stock: number;
  suggested_order_quantity: number;
  supplier_name: string;
  supplier_email: string;
  ai_message: string;
  mail_subject: string;
  mail_draft: string;
};

const AiSuggestionsContent: React.FC = () => {
  const [selectedMailSuggestion, setSelectedMailSuggestion] =
    useState<AiStockSuggestion | null>(null);

  const [selectedDetailSuggestion, setSelectedDetailSuggestion] =
    useState<AiStockSuggestion | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['products-ai-stock-suggestions'],
    queryFn: () => apiRequest<AiStockSuggestion[]>('/products/ai-stock-suggestions'),
    staleTime: 30_000,
  });

  const suggestions = data ?? [];

  const handleCopyMailDraft = async () => {
    if (!selectedMailSuggestion) return;

    const textToCopy = `Alıcı: ${selectedMailSuggestion.supplier_email}
Konu: ${selectedMailSuggestion.mail_subject}

${selectedMailSuggestion.mail_draft}`;

    await navigator.clipboard.writeText(textToCopy);
  };

  const handleOpenMailApp = () => {
    if (!selectedMailSuggestion) return;

    const mailtoUrl = `mailto:${selectedMailSuggestion.supplier_email}?subject=${encodeURIComponent(
      selectedMailSuggestion.mail_subject,
    )}&body=${encodeURIComponent(selectedMailSuggestion.mail_draft)}`;

    window.location.href = mailtoUrl;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="text-sm font-medium text-blue-600">
              Yapay Zeka Destekli Envanter Analizi
            </span>

            <h1 className="mt-2 text-2xl font-semibold text-gray-900">
              AI Stok Önerileri
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Düşük stok seviyesine yaklaşan ürünler için son 7 günlük satış
              ortalaması ve tedarik süresi dikkate alınarak önerilen sipariş
              miktarı backend tarafından hesaplanır. Analitik ajan, bu veriyi
              operasyonel aksiyona ve tedarikçi mail taslağına dönüştürür.
            </p>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            disabled={isFetching}
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
            Önerileri Yenile
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          AI stok önerileri yükleniyor...
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          AI stok önerileri alınırken bir hata oluştu. Backend endpoint veya oturum
          bilgisini kontrol edin.
        </div>
      )}

      {!isLoading && !isError && suggestions.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Şu anda AI stok önerisi oluşturulacak düşük stok ürünü bulunmuyor.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {suggestions.map((item) => (
          <div
            key={item.product_id}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {item.sku}
                </p>

                <h2 className="mt-1 text-xl font-semibold text-gray-900">
                  {item.product_name}
                </h2>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                <AlertTriangle className="size-3" />
                Kritik Stok
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  Mevcut Stok
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {item.current_stock} adet
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  Günlük Ortalama Satış
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {item.daily_average_sales} adet
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  Tedarik Süresi
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {item.lead_time_days} gün
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-700">
                  Önerilen Sipariş
                </p>
                <p className="mt-1 text-lg font-semibold text-blue-700">
                  {item.suggested_order_quantity} adet
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="mb-2 text-sm font-semibold text-blue-900">
                AI Analizi
              </p>

              <p className="text-sm leading-6 text-blue-900">
                {item.ai_message}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSelectedMailSuggestion(item)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Mail className="size-4" />
                Tedarikçiye Mail Taslağı Oluştur
              </button>

              <button
                type="button"
                onClick={() => setSelectedDetailSuggestion(item)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Detayları Gör
              </button>
            </div>

            <p className="mt-4 text-xs text-gray-500">
              Tedarikçi: {item.supplier_name} — {item.supplier_email}
            </p>
          </div>
        ))}
      </div>

      {selectedMailSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 p-6">
              <div>
                <p className="text-sm font-medium text-blue-600">
                  AI Tedarikçi Mail Taslağı
                </p>

                <h3 className="mt-1 text-xl font-semibold text-gray-900">
                  {selectedMailSuggestion.product_name}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {selectedMailSuggestion.supplier_name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMailSuggestion(null)}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Alıcı
                </label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                  {selectedMailSuggestion.supplier_email}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Konu
                </label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                  {selectedMailSuggestion.mail_subject}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Mail Metni
                </label>
                <pre className="min-h-64 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800">
                  {selectedMailSuggestion.mail_draft}
                </pre>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                Bu taslak, hesaplanmış stok verilerine göre AI tarafından operasyonel
                dile çevrilmiştir. Sayısal öneri backend formülüyle hesaplanır.
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 p-6">
              <button
                type="button"
                onClick={handleCopyMailDraft}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <Copy className="size-4" />
                Kopyala
              </button>

              <button
                type="button"
                onClick={handleOpenMailApp}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <ExternalLink className="size-4" />
                Mail Uygulamasında Aç
              </button>

              <button
                type="button"
                onClick={() => setSelectedMailSuggestion(null)}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                <CheckCircle className="size-4" />
                Taslağı Onayla
              </button>

              <button
                type="button"
                onClick={() => setSelectedMailSuggestion(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDetailSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 p-6">
              <div>
                <p className="text-sm font-medium text-blue-600">
                  Stok Hesaplama Detayı
                </p>

                <h3 className="mt-1 text-xl font-semibold text-gray-900">
                  {selectedDetailSuggestion.product_name}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  SKU: {selectedDetailSuggestion.sku}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailSuggestion(null)}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500">Mevcut Stok</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {selectedDetailSuggestion.current_stock} adet
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Günlük Ortalama Satış
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {selectedDetailSuggestion.daily_average_sales} adet
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Tedarik Süresi
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {selectedDetailSuggestion.lead_time_days} gün
                  </p>
                </div>

                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-xs font-medium text-red-700">
                    Tahmini Tükenme Süresi
                  </p>
                  <p className="mt-1 text-lg font-semibold text-red-700">
                    {selectedDetailSuggestion.days_until_out_of_stock} gün
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">
                  Önerilen Sipariş Miktarı
                </p>

                <p className="mt-2 text-2xl font-semibold text-blue-700">
                  {selectedDetailSuggestion.suggested_order_quantity} adet
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">
                  Hesaplama Formülü
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-700">
                  (Günlük Ortalama Satış × 7) + (Günlük Ortalama Satış × Tedarik Süresi)
                </p>

                <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold text-gray-900">
                  ({selectedDetailSuggestion.daily_average_sales} × 7) + (
                  {selectedDetailSuggestion.daily_average_sales} ×{' '}
                  {selectedDetailSuggestion.lead_time_days}) ={' '}
                  {selectedDetailSuggestion.suggested_order_quantity} adet
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Bu sayısal öneri AI tarafından uydurulmaz. Backend tarafında
                deterministik formülle hesaplanır. AI ajanı bu sonucu operasyonel
                analiz ve tedarikçi mail taslağına dönüştürür.
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-200 p-6">
              <button
                type="button"
                onClick={() => setSelectedDetailSuggestion(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AiStockSuggestionsPage = AiSuggestionsContent;