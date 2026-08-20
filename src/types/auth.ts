export type SUser = {
  idsuser?: string;
  eno?: string;
  eeno?: string;
  firstname?: string;
  lastname?: string;
  dob?: string;
  email1?: string;
  phone1?: string;
  utype?: string;
  userid: string;
  idcompany?: string;
  companycode?: string;
  address?: string;
  profilephoto?: string;
};

export type Branch = {
  idbranch?: string;
  latitude?: string;
  longitude?: string;
};

export type SignInResult =
  | { success: true; user: SUser }
  | { success: false; errorCode: string; message: string };

export type SignUpResult =
  | {
      success: true;
      user: { userid: string; phone1?: string; companycode: string };
      branches: Branch[];
    }
  | { success: false; message: string };
