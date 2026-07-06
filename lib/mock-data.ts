import type {
  Customer,
  Product,
  Reward,
  Notification,
  ActivityItem,
  WalletConfig,
  StoreSettings,
  VisitorDataPoint,
} from "@/types";

export const storeSettings: StoreSettings = {
  name: "Mon Établissement",
  address: "",
  city: "",
  phone: "",
  email: "",
  website: "",
  loyaltyMode: "stamps",
  pointsPerEuro: 10,
  stampsRequired: 8,
  pointsPerUnit: 1,
  welcomePoints: 0,
};

export const walletConfig: WalletConfig = {
  cardName: "Mon Établissement",
  backgroundColor: "#1a0a00",
  textColor: "#ffffff",
  accentColor: "#f59e0b",
  welcomeMessage: "Bienvenue !",
};

export const customers: Customer[] = [];
export const products: Product[] = [];
export const rewards: Reward[] = [];
export const notifications: Notification[] = [];
export const recentActivity: ActivityItem[] = [];
export const visitorData: VisitorDataPoint[] = [];

export const analyticsData = {
  weekly: [] as Array<{ label: string; visits: number; rewards: number; revenue: number }>,
  monthly: [] as Array<{ label: string; visits: number; rewards: number; revenue: number }>,
  kpis: {
    retentionRate: 0,
    visitFrequency: 0,
    activeClients: 0,
    topReward: "—",
    estimatedRevenue: 0,
    redemptionRate: 0,
  },
  topRewards: [] as Array<{ name: string; count: number; percentage: number }>,
};
