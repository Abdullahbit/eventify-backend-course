export type Venue = {
  id: string;
  name: string;
  address: string;
  capacity: number;
  contactEmail: string;
  createdAt: string;
};

export type CreateVenueInput = {
  name: string;
  address: string;
  capacity: number;
  contactEmail: string;
};

export type UpdateVenueInput = Partial<CreateVenueInput>;
