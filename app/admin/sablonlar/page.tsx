import TemplateCalibrator from './TemplateCalibrator';

export const metadata = { title: 'Mekân Şablonları — CarettaPool Admin' };

export default function SablonlarPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Mekân Şablonları</h1>
      <p className="mb-6 text-sm text-slate-500">
        Konfigüratördeki &quot;Mekânda Gör&quot; görünümü için şablon kalibrasyonu, havuz yerleşimi ve güneş ayarı.
      </p>
      <TemplateCalibrator />
    </div>
  );
}
