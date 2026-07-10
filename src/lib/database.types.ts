export type Person = 'bea' | 'phil'
export type Split = 'half' | 'phil' | 'bea'
export type RecurringType = 'continue' | 'serie'
export type Frequency = 'semaine' | 'deux_semaines' | 'mois'

export interface GasDetails {
  distanceKm: number
  tollAmount: number
  gasPricePerL: number
  vehicleId: string
}

export interface PriceRate {
  from: string
  amount: number
}

export interface Vehicle {
  id: string
  name: string
  l100: number
}

export interface Trip {
  id: string
  name: string
  km: number
  toll: number
}

// Rows
export interface HouseholdRow { id: string; created_at: string; name: string }
export interface ProfileRow { id: string; name: string; person: Person; household_id: string | null; created_at: string }
export interface InviteCodeRow { id: string; code: string; household_id: string; created_by: string; expires_at: string; used_at: string | null; used_by: string | null; created_at: string }
export interface CategoryRow { id: string; household_id: string; name: string; icon: string; created_at: string }
export interface ExpenseRow { id: string; household_id: string; date: string; description: string; category_id: string | null; amount: number; payer: Person; split: Split; gas: GasDetails | null; created_at: string; created_by: string }
export interface RecurringRow { id: string; household_id: string; type: RecurringType; description: string; category_id: string | null; payer: Person; split: Split; archived: boolean; rates: PriceRate[]; frequency: Frequency | null; start_date: string | null; occurrences: number | null; year: number | null; created_at: string; created_by: string }
export interface SettlementRow { id: string; household_id: string; date: string; from_person: Person; amount: number; created_at: string; created_by: string }
export interface SettingsRow { id: string; household_id: string; vehicles: Vehicle[]; trips: Trip[]; default_gas_price: number; updated_at: string }

// Inserts
export type HouseholdInsert = { name?: string }
export type ProfileInsert = { id: string; name: string; person: Person; household_id?: string | null }
export type ProfileUpdate = { name?: string; person?: Person; household_id?: string | null }
export type InviteCodeInsert = { code: string; household_id: string; created_by: string; expires_at: string }
export type InviteCodeUpdate = { used_at?: string; used_by?: string }
export type CategoryInsert = { household_id: string; name: string; icon?: string }
export type CategoryUpdate = { name?: string; icon?: string }
export type ExpenseInsert = { household_id: string; date: string; description: string; category_id?: string | null; amount: number; payer: Person; split: Split; gas?: GasDetails | null; created_by: string }
export type ExpenseUpdate = { date?: string; description?: string; category_id?: string | null; amount?: number; payer?: Person; split?: Split; gas?: GasDetails | null }
export type RecurringInsert = { household_id: string; type: RecurringType; description: string; category_id?: string | null; payer: Person; split: Split; archived?: boolean; rates?: PriceRate[]; frequency?: Frequency | null; start_date?: string | null; occurrences?: number | null; year?: number | null; created_by: string }
export type RecurringUpdate = { description?: string; category_id?: string | null; payer?: Person; split?: Split; archived?: boolean; rates?: PriceRate[]; frequency?: Frequency | null; start_date?: string | null; occurrences?: number | null; year?: number | null }
export type SettlementInsert = { household_id: string; date: string; from_person: Person; amount: number; created_by: string }
export type SettlementUpdate = { date?: string; from_person?: Person; amount?: number }
export type SettingsInsert = { household_id: string; vehicles?: Vehicle[]; trips?: Trip[]; default_gas_price?: number }
export type SettingsUpdate = { vehicles?: Vehicle[]; trips?: Trip[]; default_gas_price?: number }

export interface Database {
  public: {
    Tables: {
      households:   { Row: HouseholdRow;   Insert: HouseholdInsert;         Update: Partial<HouseholdInsert>;  Relationships: [] }
      profiles:     { Row: ProfileRow;     Insert: ProfileInsert;           Update: ProfileUpdate;             Relationships: [] }
      invite_codes: { Row: InviteCodeRow;  Insert: InviteCodeInsert;        Update: InviteCodeUpdate;          Relationships: [] }
      categories:   { Row: CategoryRow;   Insert: CategoryInsert;          Update: CategoryUpdate;            Relationships: [] }
      expenses:     { Row: ExpenseRow;     Insert: ExpenseInsert;           Update: ExpenseUpdate;             Relationships: [] }
      recurrings:   { Row: RecurringRow;   Insert: RecurringInsert;         Update: RecurringUpdate;           Relationships: [] }
      settlements:  { Row: SettlementRow;  Insert: SettlementInsert;        Update: SettlementUpdate;          Relationships: [] }
      settings:     { Row: SettingsRow;    Insert: SettingsInsert;          Update: SettingsUpdate;            Relationships: [] }
    }
    Views: {}
    Functions: {}
    Enums: {
      person_enum: Person
      split_enum: Split
      recurring_type_enum: RecurringType
      frequency_enum: Frequency
    }
  }
}
