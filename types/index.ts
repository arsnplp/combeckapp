export type LoyaltyMode = "points" | "stamps";
export type CustomerStatus = "active" | "vip" | "inactive" | "new";
export type NotificationStatus = "sent" | "scheduled" | "draft";
export type AudienceType = "all" | "silver" | "gold" | "platine";
export type RankType = "none" | "silver" | "gold" | "platine";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: CustomerStatus;
  points: number;
  stamps: number;
  totalVisits: number;
  lastVisit: string;
  joinDate: string;
  totalSpent: number;
  rewardsUsed: number;
  rank?: RankType;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  emoji?: string;
  imageUrl?: string;
  active: boolean;
  pointsValue?: number;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  mode: LoyaltyMode;
  emoji: string;
  productId?: string;
  usageCount: number;
  active: boolean;
  referral?: boolean;
}

export interface Notification {
  id: string;
  message: string;
  audience: AudienceType;
  status: NotificationStatus;
  sentAt: string;
  recipients: number;
}

export interface ActivityItem {
  id: string;
  type: "visit" | "reward" | "new_client" | "points_added";
  customerId?: string;
  customerName: string;
  description: string;
  time: string;
  value?: number;
}

export interface WalletConfig {
  cardName: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  welcomeMessage: string;
  logoUrl?: string;
}

export interface RankThresholds {
  silver: number;
  gold: number;
  platine: number;
}

export interface LoyaltyCard {
  id: string;
  name: string;
  welcomeMessage: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  loyaltyMode: LoyaltyMode;
  stampsRequired: number;
  pointsPerEuro: number;
  welcomePoints: number;
  active: boolean;
  createdAt: string;
  rankThresholds?: RankThresholds;
  referral?: { enabled: boolean; referrerBonus: number; bonusType: "stamps" | "points" };
}

export type PlanId = "free" | "starter" | "pro" | "business";

export interface CustomerCard {
  id: string;
  customerId: string;
  cardId: string;
  stamps: number;
  points: number;
  joinDate: string;
  lastActivity: string;
  referralCount?: number;
  referralPoints?: number;
  pendingReferrals?: number;
}

export interface StoreSettings {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  loyaltyMode: LoyaltyMode;
  pointsPerEuro: number;
  stampsRequired: number;
  pointsPerUnit: number;
  welcomePoints: number;
  logoUrl?: string;
}

export interface VisitorDataPoint {
  date: string;
  visits: number;
  newClients: number;
}

export interface AnalyticsKPI {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
}
