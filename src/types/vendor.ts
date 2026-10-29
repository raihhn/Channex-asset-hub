export type VendorContact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  active: boolean;
};
export type VendorWarehouse = {
  id: string;
  name: string;
  address: string;
  addressVerified: boolean;
  active: boolean;
  contactIds: string[];
};
export type VendorDraft = {
  name: string;
  legalName: string;
  active: boolean;
  contacts: VendorContact[];
  warehouses: VendorWarehouse[];
};
export type VendorRecord = VendorDraft & {
  id: string;
  version: number;
  updatedAt: string;
  importNotes?: {
    issues: string[];
    source: {
      vendor: string;
      warehouse: string;
      address: string;
      picName: string;
      phone: string;
      emails: string[];
    };
  }[];
};
