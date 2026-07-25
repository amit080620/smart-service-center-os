// Reference data for vehicle make/model selection — covers the brands
// most commonly seen at Indian service centers, both cars and
// two-wheelers. Not exhaustive by design: an "Other" option is always
// available as a fallback for anything not listed, so this speeds up the
// common case without blocking the uncommon one.
export interface VehicleBrand {
  make: string;
  models: string[];
}

export const CAR_BRANDS: VehicleBrand[] = [
  { make: 'Maruti Suzuki', models: ['Alto', 'Swift', 'Baleno', 'WagonR', 'Dzire', 'Ertiga', 'Brezza', 'Celerio', 'S-Presso', 'Eeco', 'Ignis', 'XL6', 'Fronx', 'Jimny', 'Grand Vitara'] },
  { make: 'Hyundai', models: ['i10', 'i20', 'Venue', 'Creta', 'Verna', 'Aura', 'Exter', 'Alcazar', 'Tucson', 'Santro'] },
  { make: 'Tata Motors', models: ['Nexon', 'Punch', 'Tiago', 'Tigor', 'Altroz', 'Harrier', 'Safari', 'Nexon EV', 'Tiago EV'] },
  { make: 'Mahindra', models: ['Bolero', 'Scorpio', 'XUV700', 'XUV300', 'Thar', 'Marazzo', 'XUV400', 'Scorpio-N'] },
  { make: 'Honda', models: ['City', 'Amaze', 'WR-V', 'Jazz', 'Elevate'] },
  { make: 'Toyota', models: ['Innova', 'Innova Crysta', 'Fortuner', 'Glanza', 'Urban Cruiser', 'Camry', 'Hyryder'] },
  { make: 'Kia', models: ['Seltos', 'Sonet', 'Carens', 'Carnival', 'EV6'] },
  { make: 'MG Motor', models: ['Hector', 'Astor', 'ZS EV', 'Comet EV', 'Gloster'] },
  { make: 'Volkswagen', models: ['Polo', 'Vento', 'Taigun', 'Virtus'] },
  { make: 'Skoda', models: ['Rapid', 'Octavia', 'Kushaq', 'Slavia', 'Superb'] },
  { make: 'Renault', models: ['Kwid', 'Triber', 'Kiger'] },
  { make: 'Nissan', models: ['Magnite', 'Kicks'] },
  { make: 'Ford', models: ['EcoSport', 'Figo', 'Aspire', 'Endeavour'] },
  { make: 'Jeep', models: ['Compass', 'Meridian'] },
  { make: 'Citroen', models: ['C3', 'C5 Aircross', 'eC3'] },
  { make: 'BMW', models: ['3 Series', '5 Series', 'X1', 'X3', 'X5'] },
  { make: 'Mercedes-Benz', models: ['C-Class', 'E-Class', 'GLA', 'GLC'] },
  { make: 'Audi', models: ['A4', 'A6', 'Q3', 'Q5'] }
];

export const BIKE_BRANDS: VehicleBrand[] = [
  { make: 'Hero MotoCorp', models: ['Splendor', 'HF Deluxe', 'Passion', 'Glamour', 'Xtreme', 'Xpulse', 'Destini 125', 'Maestro'] },
  { make: 'Honda', models: ['Activa', 'Shine', 'Unicorn', 'SP125', 'Hornet', 'Dio', 'CB350'] },
  { make: 'TVS', models: ['Jupiter', 'Apache', 'Ntorq', 'Raider', 'Sport', 'iQube', 'Star City'] },
  { make: 'Bajaj', models: ['Pulsar', 'Platina', 'CT100', 'Avenger', 'Dominar', 'Chetak'] },
  { make: 'Royal Enfield', models: ['Classic 350', 'Bullet', 'Hunter 350', 'Meteor 350', 'Himalayan', 'Continental GT'] },
  { make: 'Yamaha', models: ['FZ', 'R15', 'MT-15', 'Fascino', 'Ray ZR'] },
  { make: 'Suzuki', models: ['Access 125', 'Gixxer', 'Burgman'] },
  { make: 'KTM', models: ['Duke 125', 'Duke 200', 'Duke 390', 'RC 200', 'RC 390'] },
  { make: 'Piaggio (Vespa)', models: ['VXL', 'SXL', 'Zx'] },
  { make: 'Jawa/Yezdi', models: ['Jawa 42', 'Yezdi Roadster', 'Yezdi Adventure'] },
  { make: 'Ola Electric', models: ['S1 Pro', 'S1 Air', 'S1 X'] },
  { make: 'Ather', models: ['450X', '450S', 'Rizta'] }
];

export const OTHER_OPTION = 'Other (not listed)';
