'use client';

import { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import { CAR_BRANDS, BIKE_BRANDS, OTHER_OPTION } from '@/lib/vehicleData';

// Cascading Make → Model picker backed by a static India-brand dataset,
// with an "Other" fallback that reveals free-text inputs for anything
// not in the list — so this speeds up the common case without ever
// blocking an uncommon vehicle from being entered.
export default function BrandModelPicker({
  vehicleType,
  onVehicleTypeChange,
  make,
  onMakeChange,
  model,
  onModelChange,
  disabled
}: {
  vehicleType: 'car' | 'bike';
  onVehicleTypeChange: (type: 'car' | 'bike') => void;
  make: string;
  onMakeChange: (make: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}) {
  const brands = vehicleType === 'car' ? CAR_BRANDS : BIKE_BRANDS;
  const [customMake, setCustomMake] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [makeIsOther, setMakeIsOther] = useState(false);
  const [modelIsOther, setModelIsOther] = useState(false);

  const makeItems = [...brands.map((b) => ({ id: b.make, label: b.make })), { id: OTHER_OPTION, label: OTHER_OPTION }];
  const selectedBrand = brands.find((b) => b.make === make);
  const modelItems = selectedBrand
    ? [...selectedBrand.models.map((m) => ({ id: m, label: m })), { id: OTHER_OPTION, label: OTHER_OPTION }]
    : [];

  // Reset model whenever the vehicle type or make changes — a model from
  // the previous make almost never applies to the new one.
  useEffect(() => {
    onModelChange('');
    setModelIsOther(false);
    setCustomModel('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleType, make]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['car', 'bike'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              onVehicleTypeChange(t);
              onMakeChange('');
              setMakeIsOther(false);
              setCustomMake('');
            }}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer transition-all ${
              vehicleType === t ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'car' ? 'Car / 4-Wheeler' : 'Bike / 2-Wheeler'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Make</label>
          {makeIsOther ? (
            <input
              value={customMake}
              onChange={(e) => {
                setCustomMake(e.target.value);
                onMakeChange(e.target.value);
              }}
              placeholder="Enter make"
              disabled={disabled}
              className="w-full bg-slate-950 border border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
            />
          ) : (
            <SearchableSelect
              items={makeItems}
              value={make}
              onChange={(id) => {
                if (id === OTHER_OPTION) {
                  setMakeIsOther(true);
                  onMakeChange('');
                } else {
                  onMakeChange(id);
                }
              }}
              getLabel={(item) => item.label}
              getSearchText={(item) => item.label}
              placeholder="Search make..."
              disabled={disabled}
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Model</label>
          {modelIsOther ? (
            <input
              value={customModel}
              onChange={(e) => {
                setCustomModel(e.target.value);
                onModelChange(e.target.value);
              }}
              placeholder="Enter model"
              disabled={disabled}
              className="w-full bg-slate-950 border border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
            />
          ) : (
            <SearchableSelect
              items={modelItems}
              value={model}
              onChange={(id) => {
                if (id === OTHER_OPTION) {
                  setModelIsOther(true);
                  onModelChange('');
                } else {
                  onModelChange(id);
                }
              }}
              getLabel={(item) => item.label}
              getSearchText={(item) => item.label}
              placeholder={make ? 'Search model...' : 'Select a make first'}
              disabled={disabled || !make}
            />
          )}
        </div>
      </div>
    </div>
  );
}
