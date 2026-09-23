/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /**
   * The `Date` scalar type represents a Date
   * value as specified by
   * [iso8601](https://en.wikipedia.org/wiki/ISO_8601).
   */
  Date: { input: unknown; output: unknown; }
  /**
   * The `DateTime` scalar type represents a DateTime
   * value as specified by
   * [iso8601](https://en.wikipedia.org/wiki/ISO_8601).
   */
  DateTime: { input: unknown; output: unknown; }
  /**
   * Allows use of a JSON String for input / output from the GraphQL schema.
   *
   * Use of this type is *not recommended* as you lose the benefits of having a defined, static
   * schema (one of the key benefits of GraphQL).
   */
  JSONString: { input: unknown; output: unknown; }
};

export type SchemaArchiveProduct = {
  __typename?: 'ArchiveProduct';
  product: SchemaProductType;
};

export type SchemaAttachProductMedia = {
  __typename?: 'AttachProductMedia';
  media: SchemaProductMediaType;
};

export type SchemaBuyerDetailsInput = {
  addressLine?: InputMaybe<Scalars['String']['input']>;
  commune?: InputMaybe<Scalars['String']['input']>;
  deliveryNotes?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  recipientName?: InputMaybe<Scalars['String']['input']>;
  recipientTaxId?: InputMaybe<Scalars['String']['input']>;
  region?: InputMaybe<Scalars['String']['input']>;
  taxActivity?: InputMaybe<Scalars['String']['input']>;
  taxAddress?: InputMaybe<Scalars['String']['input']>;
  taxCommune?: InputMaybe<Scalars['String']['input']>;
  taxEmail?: InputMaybe<Scalars['String']['input']>;
  taxId?: InputMaybe<Scalars['String']['input']>;
  taxName?: InputMaybe<Scalars['String']['input']>;
  taxRegion?: InputMaybe<Scalars['String']['input']>;
  turnstileToken?: InputMaybe<Scalars['String']['input']>;
};

export type SchemaBuyerSnapshotType = {
  __typename?: 'BuyerSnapshotType';
  addressLine: Scalars['String']['output'];
  commune: Scalars['String']['output'];
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  deliveryNotes: Scalars['String']['output'];
  email: Scalars['String']['output'];
  name: Scalars['String']['output'];
  phone: Scalars['String']['output'];
  recipientName: Scalars['String']['output'];
  recipientTaxId: Scalars['String']['output'];
  region: Scalars['String']['output'];
  taxActivity: Scalars['String']['output'];
  taxAddress: Scalars['String']['output'];
  taxCommune: Scalars['String']['output'];
  taxEmail: Scalars['String']['output'];
  taxId: Scalars['String']['output'];
  taxName: Scalars['String']['output'];
  taxRegion: Scalars['String']['output'];
};

export type SchemaCancelOrder = {
  __typename?: 'CancelOrder';
  order: SchemaOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaConfirmInventoryImport = {
  __typename?: 'ConfirmInventoryImport';
  importJob: SchemaInventoryImportType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaConfirmManualPayment = {
  __typename?: 'ConfirmManualPayment';
  order: SchemaOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaCreateCustomField = {
  __typename?: 'CreateCustomField';
  field: SchemaCustomFieldType;
};

export type SchemaCreateCustomFieldInput = {
  defaultValue?: InputMaybe<Scalars['String']['input']>;
  fieldType: Scalars['String']['input'];
  helpText?: InputMaybe<Scalars['String']['input']>;
  isFilterable?: InputMaybe<Scalars['Boolean']['input']>;
  isRequired?: InputMaybe<Scalars['Boolean']['input']>;
  isVisible?: InputMaybe<Scalars['Boolean']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  label: Scalars['String']['input'];
  options?: InputMaybe<Array<SchemaCustomFieldOptionInput>>;
};

export type SchemaCreateOrder = {
  __typename?: 'CreateOrder';
  order: SchemaOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaCreateOrderInput = {
  deliveryMode: Scalars['String']['input'];
  lines: Array<SchemaCreateOrderLineInput>;
  paymentMethod: Scalars['String']['input'];
};

export type SchemaCreateOrderLineInput = {
  productId: Scalars['ID']['input'];
  quantity: Scalars['Int']['input'];
  unitSalePrice: Scalars['String']['input'];
};

export type SchemaCreateProduct = {
  __typename?: 'CreateProduct';
  movement?: Maybe<SchemaStockMovementType>;
  product: SchemaProductType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaCreateProductInput = {
  catalogStatus?: InputMaybe<Scalars['String']['input']>;
  extraAttributes?: InputMaybe<Scalars['JSONString']['input']>;
  idempotencyKey: Scalars['String']['input'];
  initialQuantity?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  purchasePrice?: InputMaybe<Scalars['String']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  salePrice?: InputMaybe<Scalars['String']['input']>;
};

export type SchemaCustomFieldOptionInput = {
  key?: InputMaybe<Scalars['String']['input']>;
  label: Scalars['String']['input'];
};

export type SchemaCustomFieldOptionType = {
  __typename?: 'CustomFieldOptionType';
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
};

export type SchemaCustomFieldType = {
  __typename?: 'CustomFieldType';
  fieldType: Scalars['String']['output'];
  helpText: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isFilterable: Scalars['Boolean']['output'];
  isRequired: Scalars['Boolean']['output'];
  isVisible: Scalars['Boolean']['output'];
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  options: Array<SchemaCustomFieldOptionType>;
  position: Scalars['Int']['output'];
};

export type SchemaDisconnectMercadoPagoConnection = {
  __typename?: 'DisconnectMercadoPagoConnection';
  connection: SchemaSellerPaymentConnectionType;
};

export type SchemaGenerateShipmentLabel = {
  __typename?: 'GenerateShipmentLabel';
  label: SchemaLabelDocumentType;
  replayed: Scalars['Boolean']['output'];
  shipment: SchemaShipmentType;
};

export type SchemaInitiateMercadoPagoCheckout = {
  __typename?: 'InitiateMercadoPagoCheckout';
  checkoutUrl: Scalars['String']['output'];
  order: SchemaPublicOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaInventoryAlertType = {
  __typename?: 'InventoryAlertType';
  alertType: Scalars['String']['output'];
  availableQuantity: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  openedAt: Scalars['DateTime']['output'];
  productId: Scalars['ID']['output'];
  productName: Scalars['String']['output'];
  status: Scalars['String']['output'];
  threshold: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type SchemaInventoryContextType = {
  __typename?: 'InventoryContextType';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type SchemaInventoryDashboardType = {
  __typename?: 'InventoryDashboardType';
  alerts: Array<SchemaInventoryAlertType>;
  archivedCount: Scalars['Int']['output'];
  available: Scalars['Int']['output'];
  lowStockCount: Scalars['Int']['output'];
  onHand: Scalars['Int']['output'];
  outOfStockCount: Scalars['Int']['output'];
  productCount: Scalars['Int']['output'];
  recentMovements: Array<SchemaStockMovementType>;
  reserved: Scalars['Int']['output'];
};

export type SchemaInventoryExportType = {
  __typename?: 'InventoryExportType';
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  downloadUrl?: Maybe<Scalars['String']['output']>;
  errorCode: Scalars['String']['output'];
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  fileFormat: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  progress: Scalars['Int']['output'];
  rowCount: Scalars['Int']['output'];
  status: Scalars['String']['output'];
};

export type SchemaInventoryImportColumnType = {
  __typename?: 'InventoryImportColumnType';
  destination: Scalars['String']['output'];
  header: Scalars['String']['output'];
  required: Scalars['Boolean']['output'];
};

export type SchemaInventoryImportTemplateType = {
  __typename?: 'InventoryImportTemplateType';
  columns: Array<SchemaInventoryImportColumnType>;
  contentBase64: Scalars['String']['output'];
  contentType: Scalars['String']['output'];
  fileName: Scalars['String']['output'];
};

export type SchemaInventoryImportType = {
  __typename?: 'InventoryImportType';
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdCount: Scalars['Int']['output'];
  errorCode: Scalars['String']['output'];
  errorCount: Scalars['Int']['output'];
  headers: Scalars['JSONString']['output'];
  id: Scalars['ID']['output'];
  mapping: Scalars['JSONString']['output'];
  previewRows: Scalars['JSONString']['output'];
  processedRows: Scalars['Int']['output'];
  progress: Scalars['Int']['output'];
  reportUrl?: Maybe<Scalars['String']['output']>;
  rowErrors: Scalars['JSONString']['output'];
  sourceFileName: Scalars['String']['output'];
  status: Scalars['String']['output'];
  totalRows: Scalars['Int']['output'];
};

export type SchemaInventorySchemaType = {
  __typename?: 'InventorySchemaType';
  fields: Array<SchemaCustomFieldType>;
  inventoryId: Scalars['ID']['output'];
  lowStockThreshold: Scalars['Int']['output'];
  maxActiveFields: Scalars['Int']['output'];
  name: Scalars['String']['output'];
};

export type SchemaLabelDocumentType = {
  __typename?: 'LabelDocumentType';
  createdAt: Scalars['DateTime']['output'];
  downloadUrl?: Maybe<Scalars['String']['output']>;
  expiresAt: Scalars['DateTime']['output'];
  fileName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
};

export type SchemaMemberType = {
  __typename?: 'MemberType';
  email: Scalars['String']['output'];
  fullName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  permissions: SchemaMembershipPermissionsType;
  role: Scalars['String']['output'];
  roleLabel: Scalars['String']['output'];
};

export type SchemaMembershipPermissionsType = {
  __typename?: 'MembershipPermissionsType';
  manageInventorySchema: Scalars['Boolean']['output'];
  manageMembers: Scalars['Boolean']['output'];
  manageSensitiveConfiguration: Scalars['Boolean']['output'];
  viewFinancials: Scalars['Boolean']['output'];
};

export type SchemaMutation = {
  __typename?: 'Mutation';
  archiveProduct: SchemaArchiveProduct;
  attachProductMedia: SchemaAttachProductMedia;
  cancelOrder: SchemaCancelOrder;
  confirmInventoryImport: SchemaConfirmInventoryImport;
  confirmManualPayment: SchemaConfirmManualPayment;
  createCustomField: SchemaCreateCustomField;
  createOrder: SchemaCreateOrder;
  createProduct: SchemaCreateProduct;
  disconnectMercadoPagoConnection: SchemaDisconnectMercadoPagoConnection;
  generateShipmentLabel: SchemaGenerateShipmentLabel;
  initiateMercadoPagoCheckout: SchemaInitiateMercadoPagoCheckout;
  previewInventoryImport: SchemaPreviewInventoryImport;
  publishOrderLink: SchemaPublishOrderLink;
  recordStockMovement: SchemaRecordStockMovement;
  refundPayment: SchemaRefundPayment;
  registerShipmentDispatch: SchemaRegisterShipmentDispatch;
  reissueBankTransferOffer: SchemaReissueBankTransferOffer;
  removeProductMedia: SchemaRemoveProductMedia;
  reorderCustomFields: SchemaReorderCustomFields;
  resendOrderLink: SchemaResendOrderLink;
  restoreOrder: SchemaRestoreOrder;
  restoreProduct: SchemaRestoreProduct;
  retryInventoryExport: SchemaRetryInventoryExport;
  retryInventoryImport: SchemaRetryInventoryImport;
  retryReconciliation: SchemaRetryReconciliation;
  reviewPaymentProof: SchemaReviewPaymentProof;
  sendOfferLink: SchemaSendOfferLink;
  setBuyerDetails: SchemaSetBuyerDetails;
  setPrimaryProductMedia: SchemaSetPrimaryProductMedia;
  startInventoryExport: SchemaStartInventoryExport;
  startInventoryImport: SchemaStartInventoryImport;
  startMercadoPagoConnection: SchemaStartMercadoPagoConnection;
  updateCustomField: SchemaUpdateCustomField;
  updateInventoryLowStockThreshold: SchemaUpdateInventoryLowStockThreshold;
  updateOrderBuyer: SchemaUpdateOrderBuyer;
  updateOrganisation: SchemaUpdateOrganisation;
  updateProduct: SchemaUpdateProduct;
  updateProductLowStockThreshold: SchemaUpdateProductLowStockThreshold;
  updateProfile: SchemaUpdateProfile;
};


export type SchemaMutationArchiveProductArgs = {
  productId: Scalars['ID']['input'];
};


export type SchemaMutationAttachProductMediaArgs = {
  assetId: Scalars['ID']['input'];
  makePrimary?: InputMaybe<Scalars['Boolean']['input']>;
  productId: Scalars['ID']['input'];
};


export type SchemaMutationCancelOrderArgs = {
  idempotencyKey: Scalars['String']['input'];
  orderId: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};


export type SchemaMutationConfirmInventoryImportArgs = {
  idempotencyKey: Scalars['String']['input'];
  importId: Scalars['ID']['input'];
};


export type SchemaMutationConfirmManualPaymentArgs = {
  amount: Scalars['String']['input'];
  idempotencyKey: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  orderId: Scalars['ID']['input'];
  paidAt: Scalars['DateTime']['input'];
};


export type SchemaMutationCreateCustomFieldArgs = {
  input: SchemaCreateCustomFieldInput;
};


export type SchemaMutationCreateOrderArgs = {
  idempotencyKey: Scalars['String']['input'];
  input: SchemaCreateOrderInput;
};


export type SchemaMutationCreateProductArgs = {
  input: SchemaCreateProductInput;
};


export type SchemaMutationGenerateShipmentLabelArgs = {
  idempotencyKey: Scalars['String']['input'];
  shipmentId: Scalars['ID']['input'];
};


export type SchemaMutationInitiateMercadoPagoCheckoutArgs = {
  idempotencyKey: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type SchemaMutationPreviewInventoryImportArgs = {
  importId: Scalars['ID']['input'];
  mapping: Scalars['JSONString']['input'];
};


export type SchemaMutationPublishOrderLinkArgs = {
  idempotencyKey: Scalars['String']['input'];
  orderId: Scalars['ID']['input'];
};


export type SchemaMutationRecordStockMovementArgs = {
  input: SchemaRecordStockMovementInput;
};


export type SchemaMutationRefundPaymentArgs = {
  idempotencyKey: Scalars['String']['input'];
  orderId: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};


export type SchemaMutationRegisterShipmentDispatchArgs = {
  idempotencyKey: Scalars['String']['input'];
  input: SchemaRegisterShipmentDispatchInput;
  shipmentId: Scalars['ID']['input'];
};


export type SchemaMutationReissueBankTransferOfferArgs = {
  idempotencyKey: Scalars['String']['input'];
  orderId: Scalars['ID']['input'];
};


export type SchemaMutationRemoveProductMediaArgs = {
  assetId: Scalars['ID']['input'];
  productId: Scalars['ID']['input'];
};


export type SchemaMutationReorderCustomFieldsArgs = {
  fieldIds: Array<Scalars['ID']['input']>;
};


export type SchemaMutationResendOrderLinkArgs = {
  idempotencyKey: Scalars['String']['input'];
  orderId: Scalars['ID']['input'];
};


export type SchemaMutationRestoreOrderArgs = {
  idempotencyKey: Scalars['String']['input'];
  orderId: Scalars['ID']['input'];
};


export type SchemaMutationRestoreProductArgs = {
  productId: Scalars['ID']['input'];
};


export type SchemaMutationRetryInventoryExportArgs = {
  exportId: Scalars['ID']['input'];
};


export type SchemaMutationRetryInventoryImportArgs = {
  importId: Scalars['ID']['input'];
};


export type SchemaMutationRetryReconciliationArgs = {
  idempotencyKey: Scalars['String']['input'];
  issueId: Scalars['ID']['input'];
};


export type SchemaMutationReviewPaymentProofArgs = {
  approved: Scalars['Boolean']['input'];
  idempotencyKey: Scalars['String']['input'];
  orderId: Scalars['ID']['input'];
  rejectionReason?: InputMaybe<Scalars['String']['input']>;
};


export type SchemaMutationSendOfferLinkArgs = {
  email: Scalars['String']['input'];
  idempotencyKey: Scalars['String']['input'];
  orderId: Scalars['ID']['input'];
};


export type SchemaMutationSetBuyerDetailsArgs = {
  input: SchemaBuyerDetailsInput;
  token: Scalars['String']['input'];
};


export type SchemaMutationSetPrimaryProductMediaArgs = {
  assetId: Scalars['ID']['input'];
  productId: Scalars['ID']['input'];
};


export type SchemaMutationStartInventoryExportArgs = {
  fileFormat: Scalars['String']['input'];
  filter?: InputMaybe<SchemaProductFilterInput>;
  idempotencyKey: Scalars['String']['input'];
};


export type SchemaMutationStartInventoryImportArgs = {
  assetId: Scalars['ID']['input'];
};


export type SchemaMutationUpdateCustomFieldArgs = {
  input: SchemaUpdateCustomFieldInput;
};


export type SchemaMutationUpdateInventoryLowStockThresholdArgs = {
  threshold: Scalars['Int']['input'];
};


export type SchemaMutationUpdateOrderBuyerArgs = {
  idempotencyKey: Scalars['String']['input'];
  input: SchemaBuyerDetailsInput;
  orderId: Scalars['ID']['input'];
};


export type SchemaMutationUpdateOrganisationArgs = {
  input: SchemaUpdateOrganisationInput;
};


export type SchemaMutationUpdateProductArgs = {
  input: SchemaUpdateProductInput;
};


export type SchemaMutationUpdateProductLowStockThresholdArgs = {
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  productId: Scalars['ID']['input'];
  threshold?: InputMaybe<Scalars['Int']['input']>;
};


export type SchemaMutationUpdateProfileArgs = {
  input: SchemaUpdateProfileInput;
};

export type SchemaOrderConnectionType = {
  __typename?: 'OrderConnectionType';
  nodes: Array<SchemaOrderType>;
  pageInfo: SchemaPageInfoType;
  totalCount: Scalars['Int']['output'];
};

export type SchemaOrderEventType = {
  __typename?: 'OrderEventType';
  createdAt: Scalars['DateTime']['output'];
  detail: Scalars['String']['output'];
  eventType: Scalars['String']['output'];
  fromStatus: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  metadata: Scalars['JSONString']['output'];
  title: Scalars['String']['output'];
  toStatus: Scalars['String']['output'];
};

export type SchemaOrderFilterInput = {
  dateFrom?: InputMaybe<Scalars['Date']['input']>;
  dateTo?: InputMaybe<Scalars['Date']['input']>;
  paymentMethod?: InputMaybe<Scalars['String']['input']>;
  paymentMethods?: InputMaybe<Array<Scalars['String']['input']>>;
  productId?: InputMaybe<Scalars['ID']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  statuses?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type SchemaOrderItemType = {
  __typename?: 'OrderItemType';
  currency: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lineNumber: Scalars['Int']['output'];
  lineTotal: Scalars['String']['output'];
  productId: Scalars['ID']['output'];
  productName: Scalars['String']['output'];
  quantity: Scalars['Int']['output'];
  unitCostSnapshot?: Maybe<Scalars['String']['output']>;
  unitSalePrice: Scalars['String']['output'];
};

export type SchemaOrderPermissionsType = {
  __typename?: 'OrderPermissionsType';
  allowedActions: Array<Scalars['String']['output']>;
  canViewCosts: Scalars['Boolean']['output'];
};

export type SchemaOrderShipmentType = {
  __typename?: 'OrderShipmentType';
  id: Scalars['ID']['output'];
  latestLabel?: Maybe<SchemaLabelDocumentType>;
};

export type SchemaOrderType = {
  __typename?: 'OrderType';
  allowedActions: Array<Scalars['String']['output']>;
  buyer?: Maybe<SchemaBuyerSnapshotType>;
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  deliveryMode: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lines: Array<SchemaOrderItemType>;
  nextAction: Scalars['String']['output'];
  number: Scalars['String']['output'];
  paidAt?: Maybe<Scalars['DateTime']['output']>;
  payment?: Maybe<SchemaPaymentType>;
  paymentMethod: Scalars['String']['output'];
  permissions: SchemaOrderPermissionsType;
  publicTokenExpiresAt: Scalars['DateTime']['output'];
  publicUrl: Scalars['String']['output'];
  publishedAt?: Maybe<Scalars['DateTime']['output']>;
  reconciliationIssues: Array<SchemaReconciliationIssueType>;
  reconciliationRequired: Scalars['Boolean']['output'];
  reconciliationStatus: Scalars['String']['output'];
  refundedAt?: Maybe<Scalars['DateTime']['output']>;
  reservationExpiresAt: Scalars['DateTime']['output'];
  shipment?: Maybe<SchemaOrderShipmentType>;
  status: Scalars['String']['output'];
  statusLabel: Scalars['String']['output'];
  timeline: Array<SchemaOrderEventType>;
  total: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type SchemaOrganisationType = {
  __typename?: 'OrganisationType';
  address: Scalars['String']['output'];
  bankAccountNumber: Scalars['String']['output'];
  bankAccountType: Scalars['String']['output'];
  bankConfirmationEmail: Scalars['String']['output'];
  bankHolderTaxId: Scalars['String']['output'];
  bankName: Scalars['String']['output'];
  businessEmail: Scalars['String']['output'];
  description: Scalars['String']['output'];
  hasBankDetails: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  logoUrl?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  phone: Scalars['String']['output'];
  timezone: Scalars['String']['output'];
};

export type SchemaPageInfoType = {
  __typename?: 'PageInfoType';
  endCursor: Scalars['String']['output'];
  hasNextPage: Scalars['Boolean']['output'];
};

export type SchemaPaymentCommissionConfigurationType = {
  __typename?: 'PaymentCommissionConfigurationType';
  minimum: Scalars['Int']['output'];
  mode: Scalars['String']['output'];
  rate: Scalars['String']['output'];
  zeroFeeEnabled: Scalars['Boolean']['output'];
};

export type SchemaPaymentConnectionStartType = {
  __typename?: 'PaymentConnectionStartType';
  authorizationUrl: Scalars['String']['output'];
  expiresAt: Scalars['DateTime']['output'];
};

export type SchemaPaymentProofType = {
  __typename?: 'PaymentProofType';
  contentType: Scalars['String']['output'];
  fileName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  rejectionReason: Scalars['String']['output'];
  reviewedAt?: Maybe<Scalars['DateTime']['output']>;
  signedUrl?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  uploadedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type SchemaPaymentType = {
  __typename?: 'PaymentType';
  amount: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  feeReported?: Maybe<Scalars['String']['output']>;
  feeRequested: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  method: Scalars['String']['output'];
  netReceived?: Maybe<Scalars['String']['output']>;
  note: Scalars['String']['output'];
  paidAt?: Maybe<Scalars['DateTime']['output']>;
  proof?: Maybe<SchemaPaymentProofType>;
  provider: Scalars['String']['output'];
  providerPaymentId: Scalars['String']['output'];
  providerPreferenceId: Scalars['String']['output'];
  providerStatus: Scalars['String']['output'];
  providerStatusDetail: Scalars['String']['output'];
  refundedAmount: Scalars['String']['output'];
  refundedAt?: Maybe<Scalars['DateTime']['output']>;
  status: Scalars['String']['output'];
};

export type SchemaPreviewInventoryImport = {
  __typename?: 'PreviewInventoryImport';
  importJob: SchemaInventoryImportType;
};

export type SchemaProductAttributeFilterInput = {
  key: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type SchemaProductConnectionType = {
  __typename?: 'ProductConnectionType';
  nodes: Array<SchemaProductType>;
  pageInfo: SchemaPageInfoType;
  totalCount: Scalars['Int']['output'];
};

export type SchemaProductFilterInput = {
  attributes?: InputMaybe<Array<SchemaProductAttributeFilterInput>>;
  catalogStatuses?: InputMaybe<Array<Scalars['String']['input']>>;
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  stockStates?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type SchemaProductMediaType = {
  __typename?: 'ProductMediaType';
  assetId: Scalars['ID']['output'];
  contentType: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  isPrimary: Scalars['Boolean']['output'];
  largeUrl: Scalars['String']['output'];
  mediumUrl: Scalars['String']['output'];
  originalName: Scalars['String']['output'];
  position: Scalars['Int']['output'];
  thumbnailUrl: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

export type SchemaProductOrderConnectionType = {
  __typename?: 'ProductOrderConnectionType';
  availableFromStage: Scalars['String']['output'];
  nodes: Array<SchemaProductOrderType>;
  pageInfo: SchemaPageInfoType;
  totalCount: Scalars['Int']['output'];
};

export type SchemaProductOrderType = {
  __typename?: 'ProductOrderType';
  buyerName?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  quantity: Scalars['Int']['output'];
  status: Scalars['String']['output'];
  unitSalePrice?: Maybe<Scalars['String']['output']>;
};

export type SchemaProductShipmentConnectionType = {
  __typename?: 'ProductShipmentConnectionType';
  availableFromStage: Scalars['String']['output'];
  nodes: Array<SchemaProductShipmentType>;
  pageInfo: SchemaPageInfoType;
  totalCount: Scalars['Int']['output'];
};

/** Populated in T3. */
export type SchemaProductShipmentType = {
  __typename?: 'ProductShipmentType';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  quantity: Scalars['Int']['output'];
  status: Scalars['String']['output'];
};

export type SchemaProductStockType = {
  __typename?: 'ProductStockType';
  activeFulfilment: Scalars['Int']['output'];
  available: Scalars['Int']['output'];
  onHand: Scalars['Int']['output'];
  reserved: Scalars['Int']['output'];
};

export type SchemaProductType = {
  __typename?: 'ProductType';
  archivedAt?: Maybe<Scalars['DateTime']['output']>;
  catalogStatus: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  effectiveLowStockThreshold: Scalars['Int']['output'];
  extraAttributes: Scalars['JSONString']['output'];
  id: Scalars['ID']['output'];
  lowStockThreshold?: Maybe<Scalars['Int']['output']>;
  media: Array<SchemaProductMediaType>;
  name: Scalars['String']['output'];
  purchasePrice?: Maybe<Scalars['String']['output']>;
  salePrice?: Maybe<Scalars['String']['output']>;
  stock: SchemaProductStockType;
  updatedAt: Scalars['DateTime']['output'];
};

export type SchemaProfileType = {
  __typename?: 'ProfileType';
  fullName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  locale: Scalars['String']['output'];
  phone: Scalars['String']['output'];
  photoUrl?: Maybe<Scalars['String']['output']>;
};

export type SchemaPublicBankDetailsType = {
  __typename?: 'PublicBankDetailsType';
  accountNumber: Scalars['String']['output'];
  accountType: Scalars['String']['output'];
  accountTypeLabel: Scalars['String']['output'];
  bankName: Scalars['String']['output'];
  confirmationEmail: Scalars['String']['output'];
  taxId: Scalars['String']['output'];
};

export type SchemaPublicOrderItemType = {
  __typename?: 'PublicOrderItemType';
  attributes: Array<SchemaPublicProductAttributeType>;
  currency: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  lineNumber: Scalars['Int']['output'];
  lineTotal: Scalars['String']['output'];
  photos: Array<Scalars['String']['output']>;
  productName: Scalars['String']['output'];
  quantity: Scalars['Int']['output'];
  unitSalePrice: Scalars['String']['output'];
};

export type SchemaPublicOrderStatusType = {
  __typename?: 'PublicOrderStatusType';
  isExpired: Scalars['Boolean']['output'];
  number: Scalars['String']['output'];
  paymentStatus?: Maybe<Scalars['String']['output']>;
  reconciliationStatus: Scalars['String']['output'];
  rejectionReason?: Maybe<Scalars['String']['output']>;
  reservationExpiresAt: Scalars['DateTime']['output'];
  status: Scalars['String']['output'];
  statusLabel: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type SchemaPublicOrderType = {
  __typename?: 'PublicOrderType';
  allowedActions: Array<Scalars['String']['output']>;
  availablePaymentMethods: Array<Scalars['String']['output']>;
  bankDetails?: Maybe<SchemaPublicBankDetailsType>;
  bankTransferInstructions: Scalars['String']['output'];
  buyer?: Maybe<SchemaBuyerSnapshotType>;
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  deliveryMode: Scalars['String']['output'];
  feeAmount?: Maybe<Scalars['String']['output']>;
  isExpired: Scalars['Boolean']['output'];
  lines: Array<SchemaPublicOrderItemType>;
  number: Scalars['String']['output'];
  payment?: Maybe<SchemaPublicPaymentType>;
  paymentMethod: Scalars['String']['output'];
  paymentStatus?: Maybe<Scalars['String']['output']>;
  reconciliationStatus: Scalars['String']['output'];
  rejectionReason?: Maybe<Scalars['String']['output']>;
  reservationExpiresAt: Scalars['DateTime']['output'];
  seller: SchemaPublicSellerType;
  status: Scalars['String']['output'];
  statusLabel: Scalars['String']['output'];
  tokenExpiresAt: Scalars['DateTime']['output'];
  total: Scalars['String']['output'];
};

export type SchemaPublicPaymentType = {
  __typename?: 'PublicPaymentType';
  amount: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  method: Scalars['String']['output'];
  proofStatus?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
};

export type SchemaPublicProductAttributeType = {
  __typename?: 'PublicProductAttributeType';
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type SchemaPublicSellerType = {
  __typename?: 'PublicSellerType';
  businessEmail: Scalars['String']['output'];
  logoUrl?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  phone: Scalars['String']['output'];
};

export type SchemaPublishOrderLink = {
  __typename?: 'PublishOrderLink';
  order: SchemaOrderType;
  publicUrl: Scalars['String']['output'];
  replayed: Scalars['Boolean']['output'];
};

export type SchemaQuery = {
  __typename?: 'Query';
  activeInventory?: Maybe<SchemaInventoryContextType>;
  activeMembership?: Maybe<SchemaMemberType>;
  health: Scalars['String']['output'];
  inventoryDashboard: SchemaInventoryDashboardType;
  inventoryExports: Array<SchemaInventoryExportType>;
  inventoryImport?: Maybe<SchemaInventoryImportType>;
  inventoryImportTemplate: SchemaInventoryImportTemplateType;
  inventoryImports: Array<SchemaInventoryImportType>;
  inventorySchema: SchemaInventorySchemaType;
  order?: Maybe<SchemaOrderType>;
  orders: SchemaOrderConnectionType;
  organisation?: Maybe<SchemaOrganisationType>;
  paymentCommissionConfiguration: SchemaPaymentCommissionConfigurationType;
  product?: Maybe<SchemaProductType>;
  productOrders: SchemaProductOrderConnectionType;
  productShipments: SchemaProductShipmentConnectionType;
  productStockBreakdown: SchemaStockBreakdownType;
  products: SchemaProductConnectionType;
  publicOrder?: Maybe<SchemaPublicOrderType>;
  publicOrderStatus?: Maybe<SchemaPublicOrderStatusType>;
  reconciliationIssues: SchemaReconciliationIssueConnectionType;
  salesBalance: SchemaSalesBalanceType;
  salesBalanceBreakdown: SchemaSalesBalanceBreakdownConnectionType;
  salesDashboard: SchemaSalesDashboardType;
  sellerPaymentConnection?: Maybe<SchemaSellerPaymentConnectionType>;
  shipment?: Maybe<SchemaShipmentType>;
  shipments: SchemaShipmentConnectionType;
  shippingDashboard: SchemaShippingDashboardType;
  stockMovements: SchemaStockMovementConnectionType;
  viewer?: Maybe<SchemaViewerType>;
};


export type SchemaQueryInventoryImportArgs = {
  id: Scalars['ID']['input'];
};


export type SchemaQueryInventorySchemaArgs = {
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type SchemaQueryOrderArgs = {
  id: Scalars['ID']['input'];
};


export type SchemaQueryOrdersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<SchemaOrderFilterInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};


export type SchemaQueryProductArgs = {
  id: Scalars['ID']['input'];
};


export type SchemaQueryProductOrdersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  productId: Scalars['ID']['input'];
};


export type SchemaQueryProductShipmentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  productId: Scalars['ID']['input'];
};


export type SchemaQueryProductStockBreakdownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  productId: Scalars['ID']['input'];
};


export type SchemaQueryProductsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  descending?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<SchemaProductFilterInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['String']['input']>;
};


export type SchemaQueryPublicOrderArgs = {
  token: Scalars['String']['input'];
};


export type SchemaQueryPublicOrderStatusArgs = {
  token: Scalars['String']['input'];
};


export type SchemaQueryReconciliationIssuesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};


export type SchemaQuerySalesBalanceArgs = {
  filter?: InputMaybe<SchemaSalesBalanceFilterInput>;
};


export type SchemaQuerySalesBalanceBreakdownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<SchemaSalesBalanceFilterInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type SchemaQueryShipmentArgs = {
  id: Scalars['ID']['input'];
};


export type SchemaQueryShipmentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<SchemaShipmentFilterInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type SchemaQueryStockMovementsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  productId: Scalars['ID']['input'];
};

export type SchemaReconciliationIssueConnectionType = {
  __typename?: 'ReconciliationIssueConnectionType';
  nodes: Array<SchemaReconciliationIssueType>;
  pageInfo: SchemaPageInfoType;
  totalCount: Scalars['Int']['output'];
};

export type SchemaReconciliationIssueType = {
  __typename?: 'ReconciliationIssueType';
  canRetry: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  details: Scalars['JSONString']['output'];
  id: Scalars['ID']['output'];
  kind: Scalars['String']['output'];
  lastAttemptAt?: Maybe<Scalars['DateTime']['output']>;
  orderId?: Maybe<Scalars['ID']['output']>;
  orderNumber?: Maybe<Scalars['String']['output']>;
  providerReference?: Maybe<Scalars['String']['output']>;
  resolvedAt?: Maybe<Scalars['DateTime']['output']>;
  retryCount: Scalars['Int']['output'];
  status: Scalars['String']['output'];
  summary: Scalars['String']['output'];
};

export type SchemaRecordStockMovement = {
  __typename?: 'RecordStockMovement';
  movement: SchemaStockMovementType;
  product: SchemaProductType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaRecordStockMovementInput = {
  correctsId?: InputMaybe<Scalars['ID']['input']>;
  idempotencyKey: Scalars['String']['input'];
  movementType: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  productId: Scalars['ID']['input'];
  quantity: Scalars['Int']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
};

export type SchemaRefundPayment = {
  __typename?: 'RefundPayment';
  order: SchemaOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaRegisterShipmentDispatch = {
  __typename?: 'RegisterShipmentDispatch';
  replayed: Scalars['Boolean']['output'];
  shipment: SchemaShipmentType;
};

export type SchemaRegisterShipmentDispatchInput = {
  carrier?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  trackingCode?: InputMaybe<Scalars['String']['input']>;
  trackingUrl?: InputMaybe<Scalars['String']['input']>;
};

export type SchemaReissueBankTransferOffer = {
  __typename?: 'ReissueBankTransferOffer';
  order: SchemaOrderType;
  publicUrl: Scalars['String']['output'];
  replayed: Scalars['Boolean']['output'];
};

export type SchemaRemoveProductMedia = {
  __typename?: 'RemoveProductMedia';
  product: SchemaProductType;
};

export type SchemaReorderCustomFields = {
  __typename?: 'ReorderCustomFields';
  fields: Array<SchemaCustomFieldType>;
};

export type SchemaResendOrderLink = {
  __typename?: 'ResendOrderLink';
  order: SchemaOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaRestoreOrder = {
  __typename?: 'RestoreOrder';
  order: SchemaOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaRestoreProduct = {
  __typename?: 'RestoreProduct';
  product: SchemaProductType;
};

export type SchemaRetryInventoryExport = {
  __typename?: 'RetryInventoryExport';
  exportJob: SchemaInventoryExportType;
};

export type SchemaRetryInventoryImport = {
  __typename?: 'RetryInventoryImport';
  importJob: SchemaInventoryImportType;
};

export type SchemaRetryReconciliation = {
  __typename?: 'RetryReconciliation';
  issue: SchemaReconciliationIssueType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaReviewPaymentProof = {
  __typename?: 'ReviewPaymentProof';
  order: SchemaOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaSalesBalanceBreakdownConnectionType = {
  __typename?: 'SalesBalanceBreakdownConnectionType';
  nodes: Array<SchemaSalesBalanceBreakdownNodeType>;
  pageInfo: SchemaPageInfoType;
  totalCount: Scalars['Int']['output'];
};

export type SchemaSalesBalanceBreakdownNodeType = {
  __typename?: 'SalesBalanceBreakdownNodeType';
  confirmedGross: Scalars['String']['output'];
  costIncomplete: Scalars['Boolean']['output'];
  grossMargin: Scalars['String']['output'];
  knownCogs: Scalars['String']['output'];
  knownCostLines: Scalars['Int']['output'];
  netSales: Scalars['String']['output'];
  paymentMethod: Scalars['String']['output'];
  period: Scalars['Date']['output'];
  productId: Scalars['ID']['output'];
  productName: Scalars['String']['output'];
  quantity: Scalars['Int']['output'];
  recognizedLines: Scalars['Int']['output'];
  refunds: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type SchemaSalesBalanceFilterInput = {
  dateFrom?: InputMaybe<Scalars['Date']['input']>;
  dateTo?: InputMaybe<Scalars['Date']['input']>;
  paymentMethod?: InputMaybe<Scalars['String']['input']>;
  paymentMethods?: InputMaybe<Array<Scalars['String']['input']>>;
  productId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  statuses?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type SchemaSalesBalanceType = {
  __typename?: 'SalesBalanceType';
  confirmedGross: Scalars['String']['output'];
  costCoverage: Scalars['String']['output'];
  costIncomplete: Scalars['Boolean']['output'];
  currency: Scalars['String']['output'];
  grossMargin: Scalars['String']['output'];
  inventoryAtCost: Scalars['String']['output'];
  inventoryAtSalePrice: Scalars['String']['output'];
  inventoryPotentialMargin: Scalars['String']['output'];
  inventoryValuationIncomplete: Scalars['Boolean']['output'];
  knownCogs: Scalars['String']['output'];
  knownCostLines: Scalars['Int']['output'];
  netSales: Scalars['String']['output'];
  operations: Scalars['Int']['output'];
  pendingAmount: Scalars['String']['output'];
  recognizedLines: Scalars['Int']['output'];
  refunds: Scalars['String']['output'];
  timezone: Scalars['String']['output'];
  validationAmount: Scalars['String']['output'];
};

export type SchemaSalesDashboardType = {
  __typename?: 'SalesDashboardType';
  activeOrders: Scalars['Int']['output'];
  awaitingBuyer: Scalars['Int']['output'];
  awaitingPayment: Scalars['Int']['output'];
  awaitingValidation: Scalars['Int']['output'];
  confirmedGross: Scalars['String']['output'];
  paidOrders: Scalars['Int']['output'];
  reconciliationRequired: Scalars['Int']['output'];
  totalOrders: Scalars['Int']['output'];
};

export type SchemaSellerPaymentConnectionType = {
  __typename?: 'SellerPaymentConnectionType';
  connectedAt?: Maybe<Scalars['DateTime']['output']>;
  disconnectedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  provider: Scalars['String']['output'];
  providerAccountId: Scalars['String']['output'];
  scopes: Array<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  tokenExpiresAt?: Maybe<Scalars['DateTime']['output']>;
};

export type SchemaSendOfferLink = {
  __typename?: 'SendOfferLink';
  order: SchemaOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaSetBuyerDetails = {
  __typename?: 'SetBuyerDetails';
  order: SchemaPublicOrderType;
};

export type SchemaSetPrimaryProductMedia = {
  __typename?: 'SetPrimaryProductMedia';
  media: SchemaProductMediaType;
};

export type SchemaShipmentConnectionType = {
  __typename?: 'ShipmentConnectionType';
  nodes: Array<SchemaShipmentType>;
  pageInfo: SchemaPageInfoType;
  totalCount: Scalars['Int']['output'];
};

export type SchemaShipmentFilterInput = {
  deliveryMode?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  statuses?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type SchemaShipmentOrderType = {
  __typename?: 'ShipmentOrderType';
  id: Scalars['ID']['output'];
  number: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type SchemaShipmentType = {
  __typename?: 'ShipmentType';
  addressLine: Scalars['String']['output'];
  allowedActions: Array<Scalars['String']['output']>;
  buyerEmail: Scalars['String']['output'];
  carrier: Scalars['String']['output'];
  commune: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  deliveredAt?: Maybe<Scalars['DateTime']['output']>;
  deliveryMode: Scalars['String']['output'];
  deliveryNotes: Scalars['String']['output'];
  dispatchNote: Scalars['String']['output'];
  dispatchedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  latestLabel?: Maybe<SchemaLabelDocumentType>;
  number: Scalars['String']['output'];
  order: SchemaShipmentOrderType;
  recipientName: Scalars['String']['output'];
  recipientTaxId: Scalars['String']['output'];
  region: Scalars['String']['output'];
  status: Scalars['String']['output'];
  statusLabel: Scalars['String']['output'];
  trackingCode: Scalars['String']['output'];
  trackingUrl: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type SchemaShippingDashboardType = {
  __typename?: 'ShippingDashboardType';
  delivered: Scalars['Int']['output'];
  dispatched: Scalars['Int']['output'];
  pending: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type SchemaStartInventoryExport = {
  __typename?: 'StartInventoryExport';
  exportJob: SchemaInventoryExportType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaStartInventoryImport = {
  __typename?: 'StartInventoryImport';
  importJob: SchemaInventoryImportType;
};

export type SchemaStartMercadoPagoConnection = {
  __typename?: 'StartMercadoPagoConnection';
  connection: SchemaPaymentConnectionStartType;
};

/** One line of the expanded row. Available units are always aggregated. */
export type SchemaStockBreakdownLineType = {
  __typename?: 'StockBreakdownLineType';
  buyerName?: Maybe<Scalars['String']['output']>;
  effectivePrice?: Maybe<Scalars['String']['output']>;
  kind: Scalars['String']['output'];
  label: Scalars['String']['output'];
  quantity: Scalars['Int']['output'];
  referenceId?: Maybe<Scalars['ID']['output']>;
  status?: Maybe<Scalars['String']['output']>;
};

export type SchemaStockBreakdownType = {
  __typename?: 'StockBreakdownType';
  available: Scalars['Int']['output'];
  lines: Array<SchemaStockBreakdownLineType>;
  pageInfo: SchemaPageInfoType;
  productId: Scalars['ID']['output'];
  totalCount: Scalars['Int']['output'];
};

export type SchemaStockMovementConnectionType = {
  __typename?: 'StockMovementConnectionType';
  nodes: Array<SchemaStockMovementType>;
  pageInfo: SchemaPageInfoType;
  totalCount: Scalars['Int']['output'];
};

export type SchemaStockMovementType = {
  __typename?: 'StockMovementType';
  actorName: Scalars['String']['output'];
  balanceAfter: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  movementType: Scalars['String']['output'];
  note: Scalars['String']['output'];
  productId: Scalars['ID']['output'];
  productName: Scalars['String']['output'];
  quantity: Scalars['Int']['output'];
  reason: Scalars['String']['output'];
  referenceId: Scalars['String']['output'];
  referenceType: Scalars['String']['output'];
};

export type SchemaUpdateCustomField = {
  __typename?: 'UpdateCustomField';
  field: SchemaCustomFieldType;
};

export type SchemaUpdateCustomFieldInput = {
  defaultValue?: InputMaybe<Scalars['String']['input']>;
  fieldId: Scalars['ID']['input'];
  helpText?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isFilterable?: InputMaybe<Scalars['Boolean']['input']>;
  isRequired?: InputMaybe<Scalars['Boolean']['input']>;
  isVisible?: InputMaybe<Scalars['Boolean']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<Array<SchemaCustomFieldOptionInput>>;
};

export type SchemaUpdateInventoryLowStockThreshold = {
  __typename?: 'UpdateInventoryLowStockThreshold';
  threshold: Scalars['Int']['output'];
};

export type SchemaUpdateOrderBuyer = {
  __typename?: 'UpdateOrderBuyer';
  order: SchemaOrderType;
  replayed: Scalars['Boolean']['output'];
};

export type SchemaUpdateOrganisation = {
  __typename?: 'UpdateOrganisation';
  organisation: SchemaOrganisationType;
};

export type SchemaUpdateOrganisationInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  bankAccountNumber?: InputMaybe<Scalars['String']['input']>;
  bankAccountType?: InputMaybe<Scalars['String']['input']>;
  bankConfirmationEmail?: InputMaybe<Scalars['String']['input']>;
  bankHolderTaxId?: InputMaybe<Scalars['String']['input']>;
  bankName?: InputMaybe<Scalars['String']['input']>;
  businessEmail: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  logoAssetId?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  phone: Scalars['String']['input'];
  timezone: Scalars['String']['input'];
};

export type SchemaUpdateProduct = {
  __typename?: 'UpdateProduct';
  product: SchemaProductType;
};

export type SchemaUpdateProductInput = {
  catalogStatus?: InputMaybe<Scalars['String']['input']>;
  clearPurchasePrice?: InputMaybe<Scalars['Boolean']['input']>;
  clearSalePrice?: InputMaybe<Scalars['Boolean']['input']>;
  extraAttributes?: InputMaybe<Scalars['JSONString']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  productId: Scalars['ID']['input'];
  purchasePrice?: InputMaybe<Scalars['String']['input']>;
  salePrice?: InputMaybe<Scalars['String']['input']>;
};

export type SchemaUpdateProductLowStockThreshold = {
  __typename?: 'UpdateProductLowStockThreshold';
  product: SchemaProductType;
};

export type SchemaUpdateProfile = {
  __typename?: 'UpdateProfile';
  profile: SchemaProfileType;
};

export type SchemaUpdateProfileInput = {
  fullName: Scalars['String']['input'];
  phone: Scalars['String']['input'];
  photoAssetId?: InputMaybe<Scalars['ID']['input']>;
};

export type SchemaViewerType = {
  __typename?: 'ViewerType';
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  profile: SchemaProfileType;
};

export type OperationBuyerDetailsInput = {
  addressLine?: string | null | undefined;
  commune?: string | null | undefined;
  deliveryNotes?: string | null | undefined;
  email?: string | null | undefined;
  name: string;
  phone?: string | null | undefined;
  recipientName?: string | null | undefined;
  recipientTaxId?: string | null | undefined;
  region?: string | null | undefined;
  taxActivity?: string | null | undefined;
  taxAddress?: string | null | undefined;
  taxCommune?: string | null | undefined;
  taxEmail?: string | null | undefined;
  taxId?: string | null | undefined;
  taxName?: string | null | undefined;
  taxRegion?: string | null | undefined;
  turnstileToken?: string | null | undefined;
};

export type OperationCreateCustomFieldInput = {
  defaultValue?: string | null | undefined;
  fieldType: string;
  helpText?: string | null | undefined;
  isFilterable?: boolean | null | undefined;
  isRequired?: boolean | null | undefined;
  isVisible?: boolean | null | undefined;
  key?: string | null | undefined;
  label: string;
  options?: Array<OperationCustomFieldOptionInput> | null | undefined;
};

export type OperationCreateOrderInput = {
  deliveryMode: string;
  lines: Array<OperationCreateOrderLineInput>;
  paymentMethod: string;
};

export type OperationCreateOrderLineInput = {
  productId: string | number;
  quantity: number;
  unitSalePrice: string;
};

export type OperationCreateProductInput = {
  catalogStatus?: string | null | undefined;
  extraAttributes?: unknown;
  idempotencyKey: string;
  initialQuantity?: number | null | undefined;
  name: string;
  note?: string | null | undefined;
  purchasePrice?: string | null | undefined;
  reason?: string | null | undefined;
  salePrice?: string | null | undefined;
};

export type OperationCustomFieldOptionInput = {
  key?: string | null | undefined;
  label: string;
};

export type OperationOrderFilterInput = {
  dateFrom?: unknown;
  dateTo?: unknown;
  paymentMethod?: string | null | undefined;
  paymentMethods?: Array<string> | null | undefined;
  productId?: string | number | null | undefined;
  search?: string | null | undefined;
  status?: string | null | undefined;
  statuses?: Array<string> | null | undefined;
};

export type OperationProductAttributeFilterInput = {
  key: string;
  value: string;
};

export type OperationProductFilterInput = {
  attributes?: Array<OperationProductAttributeFilterInput> | null | undefined;
  catalogStatuses?: Array<string> | null | undefined;
  includeArchived?: boolean | null | undefined;
  search?: string | null | undefined;
  stockStates?: Array<string> | null | undefined;
};

export type OperationRecordStockMovementInput = {
  correctsId?: string | number | null | undefined;
  idempotencyKey: string;
  movementType: string;
  note?: string | null | undefined;
  productId: string | number;
  quantity: number;
  reason?: string | null | undefined;
};

export type OperationRegisterShipmentDispatchInput = {
  carrier?: string | null | undefined;
  note?: string | null | undefined;
  trackingCode?: string | null | undefined;
  trackingUrl?: string | null | undefined;
};

export type OperationSalesBalanceFilterInput = {
  dateFrom?: unknown;
  dateTo?: unknown;
  paymentMethod?: string | null | undefined;
  paymentMethods?: Array<string> | null | undefined;
  productId?: string | number | null | undefined;
  status?: string | null | undefined;
  statuses?: Array<string> | null | undefined;
};

export type OperationShipmentFilterInput = {
  deliveryMode?: string | null | undefined;
  search?: string | null | undefined;
  statuses?: Array<string> | null | undefined;
};

export type OperationUpdateCustomFieldInput = {
  defaultValue?: string | null | undefined;
  fieldId: string | number;
  helpText?: string | null | undefined;
  isActive?: boolean | null | undefined;
  isFilterable?: boolean | null | undefined;
  isRequired?: boolean | null | undefined;
  isVisible?: boolean | null | undefined;
  label?: string | null | undefined;
  options?: Array<OperationCustomFieldOptionInput> | null | undefined;
};

export type OperationUpdateOrganisationInput = {
  address?: string | null | undefined;
  bankAccountNumber?: string | null | undefined;
  bankAccountType?: string | null | undefined;
  bankConfirmationEmail?: string | null | undefined;
  bankHolderTaxId?: string | null | undefined;
  bankName?: string | null | undefined;
  businessEmail: string;
  description?: string | null | undefined;
  logoAssetId?: string | number | null | undefined;
  name: string;
  phone: string;
  timezone: string;
};

export type OperationUpdateProductInput = {
  catalogStatus?: string | null | undefined;
  clearPurchasePrice?: boolean | null | undefined;
  clearSalePrice?: boolean | null | undefined;
  extraAttributes?: unknown;
  name?: string | null | undefined;
  productId: string | number;
  purchasePrice?: string | null | undefined;
  salePrice?: string | null | undefined;
};

export type OperationUpdateProfileInput = {
  fullName: string;
  phone: string;
  photoAssetId?: string | number | null | undefined;
};

export type OperationUpdateProfileMutationVariables = Exact<{
  input: OperationUpdateProfileInput;
}>;


export type OperationUpdateProfileMutation = { updateProfile: { profile: { id: string, fullName: string, phone: string, locale: string, photoUrl: string | null } } };

export type OperationUpdateOrganisationMutationVariables = Exact<{
  input: OperationUpdateOrganisationInput;
}>;


export type OperationUpdateOrganisationMutation = { updateOrganisation: { organisation: { id: string, name: string, timezone: string, phone: string, businessEmail: string, address: string, description: string, logoUrl: string | null, bankName: string, bankAccountType: string, bankAccountNumber: string, bankHolderTaxId: string, bankConfirmationEmail: string, hasBankDetails: boolean } } };

export type OperationProductRowFragment = { id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } };

export type OperationStockMovementRowFragment = { id: string, productId: string, productName: string, movementType: string, quantity: number, balanceAfter: number, reason: string, note: string, actorName: string, createdAt: unknown };

export type OperationCustomFieldDefinitionFragment = { id: string, key: string, label: string, fieldType: string, helpText: string, isRequired: boolean, isVisible: boolean, isFilterable: boolean, isActive: boolean, position: number, options: Array<{ key: string, label: string }> };

export type OperationProductMediaFragment = { assetId: string, url: string, thumbnailUrl: string, mediumUrl: string, largeUrl: string, contentType: string, originalName: string, isPrimary: boolean, position: number, createdAt: unknown };

export type OperationInventoryAlertFragment = { id: string, productId: string, productName: string, alertType: string, status: string, threshold: number, availableQuantity: number, openedAt: unknown, updatedAt: unknown };

export type OperationInventoryImportJobFragment = { id: string, status: string, progress: number, sourceFileName: string, headers: unknown, previewRows: unknown, mapping: unknown, rowErrors: unknown, totalRows: number, processedRows: number, createdCount: number, errorCount: number, errorCode: string, reportUrl: string | null, createdAt: unknown, completedAt: unknown };

export type OperationInventoryExportJobFragment = { id: string, status: string, fileFormat: string, progress: number, rowCount: number, errorCode: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, completedAt: unknown };

export type OperationInventorySchemaQueryVariables = Exact<{
  includeInactive?: boolean | null | undefined;
}>;


export type OperationInventorySchemaQuery = { inventorySchema: { inventoryId: string, name: string, lowStockThreshold: number, maxActiveFields: number, fields: Array<{ id: string, key: string, label: string, fieldType: string, helpText: string, isRequired: boolean, isVisible: boolean, isFilterable: boolean, isActive: boolean, position: number, options: Array<{ key: string, label: string }> }> } };

export type OperationInventoryDashboardQueryVariables = Exact<{ [key: string]: never; }>;


export type OperationInventoryDashboardQuery = { inventoryDashboard: { productCount: number, archivedCount: number, onHand: number, reserved: number, available: number, outOfStockCount: number, lowStockCount: number, alerts: Array<{ id: string, productId: string, productName: string, alertType: string, status: string, threshold: number, availableQuantity: number, openedAt: unknown, updatedAt: unknown }>, recentMovements: Array<{ id: string, productId: string, productName: string, movementType: string, quantity: number, balanceAfter: number, reason: string, note: string, actorName: string, createdAt: unknown }> } };

export type OperationProductsQueryVariables = Exact<{
  filter?: OperationProductFilterInput | null | undefined;
  sort?: string | null | undefined;
  descending?: boolean | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type OperationProductsQuery = { products: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string }, nodes: Array<{ id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } }> } };

export type OperationProductDetailQueryVariables = Exact<{
  id: string | number;
}>;


export type OperationProductDetailQuery = { product: { createdAt: unknown, updatedAt: unknown, id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, media: Array<{ assetId: string, url: string, thumbnailUrl: string, mediumUrl: string, largeUrl: string, contentType: string, originalName: string, isPrimary: boolean, position: number, createdAt: unknown }>, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } } | null, productStockBreakdown: { available: number, totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string }, lines: Array<{ kind: string, label: string, quantity: number, effectivePrice: string | null, buyerName: string | null, status: string | null, referenceId: string | null }> }, productOrders: { totalCount: number, availableFromStage: string, nodes: Array<{ id: string, status: string, quantity: number, unitSalePrice: string | null, buyerName: string | null, createdAt: unknown }> }, productShipments: { totalCount: number, availableFromStage: string, nodes: Array<{ id: string, status: string, quantity: number, createdAt: unknown }> } };

export type OperationProductBreakdownQueryVariables = Exact<{
  productId: string | number;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type OperationProductBreakdownQuery = { productStockBreakdown: { available: number, totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string }, lines: Array<{ kind: string, label: string, quantity: number, effectivePrice: string | null, buyerName: string | null, status: string | null, referenceId: string | null }> } };

export type OperationProductMovementsQueryVariables = Exact<{
  productId: string | number;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type OperationProductMovementsQuery = { stockMovements: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string }, nodes: Array<{ id: string, productId: string, productName: string, movementType: string, quantity: number, balanceAfter: number, reason: string, note: string, actorName: string, createdAt: unknown }> } };

export type OperationCreateProductMutationVariables = Exact<{
  input: OperationCreateProductInput;
}>;


export type OperationCreateProductMutation = { createProduct: { replayed: boolean, product: { id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } }, movement: { id: string, productId: string, productName: string, movementType: string, quantity: number, balanceAfter: number, reason: string, note: string, actorName: string, createdAt: unknown } | null } };

export type OperationUpdateProductMutationVariables = Exact<{
  input: OperationUpdateProductInput;
}>;


export type OperationUpdateProductMutation = { updateProduct: { product: { id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } } } };

export type OperationRecordStockMovementMutationVariables = Exact<{
  input: OperationRecordStockMovementInput;
}>;


export type OperationRecordStockMovementMutation = { recordStockMovement: { replayed: boolean, movement: { id: string, productId: string, productName: string, movementType: string, quantity: number, balanceAfter: number, reason: string, note: string, actorName: string, createdAt: unknown }, product: { id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } } } };

export type OperationArchiveProductMutationVariables = Exact<{
  productId: string | number;
}>;


export type OperationArchiveProductMutation = { archiveProduct: { product: { id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } } } };

export type OperationRestoreProductMutationVariables = Exact<{
  productId: string | number;
}>;


export type OperationRestoreProductMutation = { restoreProduct: { product: { id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } } } };

export type OperationCreateCustomFieldMutationVariables = Exact<{
  input: OperationCreateCustomFieldInput;
}>;


export type OperationCreateCustomFieldMutation = { createCustomField: { field: { id: string, key: string, label: string, fieldType: string, helpText: string, isRequired: boolean, isVisible: boolean, isFilterable: boolean, isActive: boolean, position: number, options: Array<{ key: string, label: string }> } } };

export type OperationUpdateCustomFieldMutationVariables = Exact<{
  input: OperationUpdateCustomFieldInput;
}>;


export type OperationUpdateCustomFieldMutation = { updateCustomField: { field: { id: string, key: string, label: string, fieldType: string, helpText: string, isRequired: boolean, isVisible: boolean, isFilterable: boolean, isActive: boolean, position: number, options: Array<{ key: string, label: string }> } } };

export type OperationReorderCustomFieldsMutationVariables = Exact<{
  fieldIds: Array<string | number> | string | number;
}>;


export type OperationReorderCustomFieldsMutation = { reorderCustomFields: { fields: Array<{ id: string, key: string, label: string, fieldType: string, helpText: string, isRequired: boolean, isVisible: boolean, isFilterable: boolean, isActive: boolean, position: number, options: Array<{ key: string, label: string }> }> } };

export type OperationInventoryImportQueryVariables = Exact<{
  id: string | number;
}>;


export type OperationInventoryImportQuery = { inventoryImport: { id: string, status: string, progress: number, sourceFileName: string, headers: unknown, previewRows: unknown, mapping: unknown, rowErrors: unknown, totalRows: number, processedRows: number, createdCount: number, errorCount: number, errorCode: string, reportUrl: string | null, createdAt: unknown, completedAt: unknown } | null };

export type OperationInventoryImportsQueryVariables = Exact<{ [key: string]: never; }>;


export type OperationInventoryImportsQuery = { inventoryImports: Array<{ id: string, status: string, progress: number, sourceFileName: string, headers: unknown, previewRows: unknown, mapping: unknown, rowErrors: unknown, totalRows: number, processedRows: number, createdCount: number, errorCount: number, errorCode: string, reportUrl: string | null, createdAt: unknown, completedAt: unknown }> };

export type OperationInventoryExportsQueryVariables = Exact<{ [key: string]: never; }>;


export type OperationInventoryExportsQuery = { inventoryExports: Array<{ id: string, status: string, fileFormat: string, progress: number, rowCount: number, errorCode: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, completedAt: unknown }> };

export type OperationInventoryImportTemplateQueryVariables = Exact<{ [key: string]: never; }>;


export type OperationInventoryImportTemplateQuery = { inventoryImportTemplate: { fileName: string, contentType: string, contentBase64: string, columns: Array<{ destination: string, header: string, required: boolean }> } };

export type OperationAttachProductMediaMutationVariables = Exact<{
  productId: string | number;
  assetId: string | number;
  makePrimary?: boolean | null | undefined;
}>;


export type OperationAttachProductMediaMutation = { attachProductMedia: { media: { assetId: string, url: string, thumbnailUrl: string, mediumUrl: string, largeUrl: string, contentType: string, originalName: string, isPrimary: boolean, position: number, createdAt: unknown } } };

export type OperationSetPrimaryProductMediaMutationVariables = Exact<{
  productId: string | number;
  assetId: string | number;
}>;


export type OperationSetPrimaryProductMediaMutation = { setPrimaryProductMedia: { media: { assetId: string, url: string, thumbnailUrl: string, mediumUrl: string, largeUrl: string, contentType: string, originalName: string, isPrimary: boolean, position: number, createdAt: unknown } } };

export type OperationRemoveProductMediaMutationVariables = Exact<{
  productId: string | number;
  assetId: string | number;
}>;


export type OperationRemoveProductMediaMutation = { removeProductMedia: { product: { id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } } } };

export type OperationStartInventoryImportMutationVariables = Exact<{
  assetId: string | number;
}>;


export type OperationStartInventoryImportMutation = { startInventoryImport: { importJob: { id: string, status: string, progress: number, sourceFileName: string, headers: unknown, previewRows: unknown, mapping: unknown, rowErrors: unknown, totalRows: number, processedRows: number, createdCount: number, errorCount: number, errorCode: string, reportUrl: string | null, createdAt: unknown, completedAt: unknown } } };

export type OperationPreviewInventoryImportMutationVariables = Exact<{
  importId: string | number;
  mapping: unknown;
}>;


export type OperationPreviewInventoryImportMutation = { previewInventoryImport: { importJob: { id: string, status: string, progress: number, sourceFileName: string, headers: unknown, previewRows: unknown, mapping: unknown, rowErrors: unknown, totalRows: number, processedRows: number, createdCount: number, errorCount: number, errorCode: string, reportUrl: string | null, createdAt: unknown, completedAt: unknown } } };

export type OperationConfirmInventoryImportMutationVariables = Exact<{
  importId: string | number;
  idempotencyKey: string;
}>;


export type OperationConfirmInventoryImportMutation = { confirmInventoryImport: { replayed: boolean, importJob: { id: string, status: string, progress: number, sourceFileName: string, headers: unknown, previewRows: unknown, mapping: unknown, rowErrors: unknown, totalRows: number, processedRows: number, createdCount: number, errorCount: number, errorCode: string, reportUrl: string | null, createdAt: unknown, completedAt: unknown } } };

export type OperationRetryInventoryImportMutationVariables = Exact<{
  importId: string | number;
}>;


export type OperationRetryInventoryImportMutation = { retryInventoryImport: { importJob: { id: string, status: string, progress: number, sourceFileName: string, headers: unknown, previewRows: unknown, mapping: unknown, rowErrors: unknown, totalRows: number, processedRows: number, createdCount: number, errorCount: number, errorCode: string, reportUrl: string | null, createdAt: unknown, completedAt: unknown } } };

export type OperationStartInventoryExportMutationVariables = Exact<{
  fileFormat: string;
  filter?: OperationProductFilterInput | null | undefined;
  idempotencyKey: string;
}>;


export type OperationStartInventoryExportMutation = { startInventoryExport: { replayed: boolean, exportJob: { id: string, status: string, fileFormat: string, progress: number, rowCount: number, errorCode: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, completedAt: unknown } } };

export type OperationRetryInventoryExportMutationVariables = Exact<{
  exportId: string | number;
}>;


export type OperationRetryInventoryExportMutation = { retryInventoryExport: { exportJob: { id: string, status: string, fileFormat: string, progress: number, rowCount: number, errorCode: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, completedAt: unknown } } };

export type OperationUpdateInventoryLowStockThresholdMutationVariables = Exact<{
  threshold: number;
}>;


export type OperationUpdateInventoryLowStockThresholdMutation = { updateInventoryLowStockThreshold: { threshold: number } };

export type OperationUpdateProductLowStockThresholdMutationVariables = Exact<{
  productId: string | number;
  threshold?: number | null | undefined;
  clear?: boolean | null | undefined;
}>;


export type OperationUpdateProductLowStockThresholdMutation = { updateProductLowStockThreshold: { product: { id: string, name: string, catalogStatus: string, purchasePrice: string | null, salePrice: string | null, currency: string, extraAttributes: unknown, lowStockThreshold: number | null, effectiveLowStockThreshold: number, archivedAt: unknown, stock: { onHand: number, reserved: number, available: number, activeFulfilment: number } } } };

export type OperationSellerPaymentConnectionQueryVariables = Exact<{ [key: string]: never; }>;


export type OperationSellerPaymentConnectionQuery = { sellerPaymentConnection: { id: string, provider: string, status: string, providerAccountId: string, scopes: Array<string>, tokenExpiresAt: unknown, connectedAt: unknown, disconnectedAt: unknown } | null, paymentCommissionConfiguration: { mode: string, rate: string, minimum: number, zeroFeeEnabled: boolean } };

export type OperationStartMercadoPagoConnectionMutationVariables = Exact<{ [key: string]: never; }>;


export type OperationStartMercadoPagoConnectionMutation = { startMercadoPagoConnection: { connection: { authorizationUrl: string, expiresAt: unknown } } };

export type OperationDisconnectMercadoPagoConnectionMutationVariables = Exact<{ [key: string]: never; }>;


export type OperationDisconnectMercadoPagoConnectionMutation = { disconnectMercadoPagoConnection: { connection: { id: string, provider: string, status: string, disconnectedAt: unknown } } };

export type OperationOrderLineFragment = { id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string };

export type OperationBuyerSnapshotFragment = { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string };

export type OperationPaymentProofFragment = { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string };

export type OperationPaymentFragment = { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null };

export type OperationOrderTimelineFragment = { id: string, eventType: string, title: string, detail: string, createdAt: unknown };

export type OperationReconciliationIssueFragment = { id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean };

export type OperationSellerOrderSummaryFragment = { id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, buyer: { name: string } | null, payment: { proof: { id: string } | null } | null };

export type OperationSellerOrderFragment = { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null };

export type OperationPublicSellerFragment = { name: string, phone: string, businessEmail: string, logoUrl: string | null };

export type OperationPublicOrderLineFragment = { id: string, productName: string, quantity: number, unitSalePrice: string, currency: string, lineTotal: string, imageUrl: string | null, photos: Array<string>, attributes: Array<{ label: string, value: string }> };

export type OperationPublicOrderFragment = { number: string, status: string, statusLabel: string, paymentStatus: string | null, currency: string, feeAmount: string | null, total: string, deliveryMode: string, paymentMethod: string, availablePaymentMethods: Array<string>, bankTransferInstructions: string, reservationExpiresAt: unknown, createdAt: unknown, rejectionReason: string | null, isExpired: boolean, allowedActions: Array<string>, bankDetails: { bankName: string, accountType: string, accountTypeLabel: string, accountNumber: string, taxId: string, confirmationEmail: string } | null, seller: { name: string, phone: string, businessEmail: string, logoUrl: string | null }, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, lines: Array<{ id: string, productName: string, quantity: number, unitSalePrice: string, currency: string, lineTotal: string, imageUrl: string | null, photos: Array<string>, attributes: Array<{ label: string, value: string }> }> };

export type OperationSalesDashboardQueryVariables = Exact<{ [key: string]: never; }>;


export type OperationSalesDashboardQuery = { salesDashboard: { totalOrders: number, activeOrders: number, awaitingBuyer: number, awaitingPayment: number, awaitingValidation: number, paidOrders: number, reconciliationRequired: number, confirmedGross: string } };

export type OperationOrdersQueryVariables = Exact<{
  filter?: OperationOrderFilterInput | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type OperationOrdersQuery = { orders: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string }, nodes: Array<{ id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, buyer: { name: string } | null, payment: { proof: { id: string } | null } | null }> } };

export type OperationOrderQueryVariables = Exact<{
  id: string | number;
}>;


export type OperationOrderQuery = { order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } | null };

export type OperationPublicOrderQueryVariables = Exact<{
  token: string;
}>;


export type OperationPublicOrderQuery = { publicOrder: { number: string, status: string, statusLabel: string, paymentStatus: string | null, currency: string, feeAmount: string | null, total: string, deliveryMode: string, paymentMethod: string, availablePaymentMethods: Array<string>, bankTransferInstructions: string, reservationExpiresAt: unknown, createdAt: unknown, rejectionReason: string | null, isExpired: boolean, allowedActions: Array<string>, bankDetails: { bankName: string, accountType: string, accountTypeLabel: string, accountNumber: string, taxId: string, confirmationEmail: string } | null, seller: { name: string, phone: string, businessEmail: string, logoUrl: string | null }, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, lines: Array<{ id: string, productName: string, quantity: number, unitSalePrice: string, currency: string, lineTotal: string, imageUrl: string | null, photos: Array<string>, attributes: Array<{ label: string, value: string }> }> } | null };

export type OperationPublicOrderStatusQueryVariables = Exact<{
  token: string;
}>;


export type OperationPublicOrderStatusQuery = { publicOrderStatus: { number: string, status: string, statusLabel: string, paymentStatus: string | null, reservationExpiresAt: unknown, updatedAt: unknown, rejectionReason: string | null, isExpired: boolean } | null };

export type OperationSalesBalanceQueryVariables = Exact<{
  filter?: OperationSalesBalanceFilterInput | null | undefined;
}>;


export type OperationSalesBalanceQuery = { salesBalance: { currency: string, timezone: string, confirmedGross: string, refunds: string, netSales: string, knownCogs: string, grossMargin: string, pendingAmount: string, validationAmount: string, operations: number, recognizedLines: number, knownCostLines: number, costCoverage: string, costIncomplete: boolean, inventoryAtCost: string, inventoryAtSalePrice: string, inventoryPotentialMargin: string, inventoryValuationIncomplete: boolean } };

export type OperationSalesBalanceBreakdownQueryVariables = Exact<{
  filter?: OperationSalesBalanceFilterInput | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type OperationSalesBalanceBreakdownQuery = { salesBalanceBreakdown: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string }, nodes: Array<{ period: unknown, productId: string, productName: string, paymentMethod: string, status: string, quantity: number, confirmedGross: string, refunds: string, netSales: string, knownCogs: string, grossMargin: string, recognizedLines: number, knownCostLines: number, costIncomplete: boolean }> } };

export type OperationReconciliationIssuesQueryVariables = Exact<{
  status?: string | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type OperationReconciliationIssuesQuery = { reconciliationIssues: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string }, nodes: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }> } };

export type OperationCreateOrderMutationVariables = Exact<{
  input: OperationCreateOrderInput;
  idempotencyKey: string;
}>;


export type OperationCreateOrderMutation = { createOrder: { replayed: boolean, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationPublishOrderLinkMutationVariables = Exact<{
  orderId: string | number;
  idempotencyKey: string;
}>;


export type OperationPublishOrderLinkMutation = { publishOrderLink: { replayed: boolean, publicUrl: string, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationSetBuyerDetailsMutationVariables = Exact<{
  token: string;
  input: OperationBuyerDetailsInput;
}>;


export type OperationSetBuyerDetailsMutation = { setBuyerDetails: { order: { number: string, status: string, statusLabel: string, paymentStatus: string | null, currency: string, feeAmount: string | null, total: string, deliveryMode: string, paymentMethod: string, availablePaymentMethods: Array<string>, bankTransferInstructions: string, reservationExpiresAt: unknown, createdAt: unknown, rejectionReason: string | null, isExpired: boolean, allowedActions: Array<string>, bankDetails: { bankName: string, accountType: string, accountTypeLabel: string, accountNumber: string, taxId: string, confirmationEmail: string } | null, seller: { name: string, phone: string, businessEmail: string, logoUrl: string | null }, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, lines: Array<{ id: string, productName: string, quantity: number, unitSalePrice: string, currency: string, lineTotal: string, imageUrl: string | null, photos: Array<string>, attributes: Array<{ label: string, value: string }> }> } } };

export type OperationUpdateOrderBuyerMutationVariables = Exact<{
  orderId: string | number;
  input: OperationBuyerDetailsInput;
  idempotencyKey: string;
}>;


export type OperationUpdateOrderBuyerMutation = { updateOrderBuyer: { replayed: boolean, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationInitiateMercadoPagoCheckoutMutationVariables = Exact<{
  token: string;
  idempotencyKey: string;
}>;


export type OperationInitiateMercadoPagoCheckoutMutation = { initiateMercadoPagoCheckout: { checkoutUrl: string, replayed: boolean } };

export type OperationReviewPaymentProofMutationVariables = Exact<{
  orderId: string | number;
  approved: boolean;
  rejectionReason?: string | null | undefined;
  idempotencyKey: string;
}>;


export type OperationReviewPaymentProofMutation = { reviewPaymentProof: { replayed: boolean, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationConfirmManualPaymentMutationVariables = Exact<{
  orderId: string | number;
  amount: string;
  paidAt: unknown;
  note?: string | null | undefined;
  idempotencyKey: string;
}>;


export type OperationConfirmManualPaymentMutation = { confirmManualPayment: { replayed: boolean, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationCancelOrderMutationVariables = Exact<{
  orderId: string | number;
  reason: string;
  idempotencyKey: string;
}>;


export type OperationCancelOrderMutation = { cancelOrder: { replayed: boolean, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationRestoreOrderMutationVariables = Exact<{
  orderId: string | number;
  idempotencyKey: string;
}>;


export type OperationRestoreOrderMutation = { restoreOrder: { replayed: boolean, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationRefundPaymentMutationVariables = Exact<{
  orderId: string | number;
  reason: string;
  idempotencyKey: string;
}>;


export type OperationRefundPaymentMutation = { refundPayment: { replayed: boolean, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationResendOrderLinkMutationVariables = Exact<{
  orderId: string | number;
  idempotencyKey: string;
}>;


export type OperationResendOrderLinkMutation = { resendOrderLink: { replayed: boolean, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationSendOfferLinkMutationVariables = Exact<{
  orderId: string | number;
  email: string;
  idempotencyKey: string;
}>;


export type OperationSendOfferLinkMutation = { sendOfferLink: { replayed: boolean, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationReissueBankTransferOfferMutationVariables = Exact<{
  orderId: string | number;
  idempotencyKey: string;
}>;


export type OperationReissueBankTransferOfferMutation = { reissueBankTransferOffer: { replayed: boolean, publicUrl: string, order: { deliveryMode: string, publicUrl: string, publishedAt: unknown, updatedAt: unknown, publicTokenExpiresAt: unknown, allowedActions: Array<string>, id: string, number: string, status: string, statusLabel: string, currency: string, total: string, paymentMethod: string, nextAction: string, reconciliationRequired: boolean, reconciliationStatus: string, reservationExpiresAt: unknown, paidAt: unknown, createdAt: unknown, permissions: { canViewCosts: boolean, allowedActions: Array<string> }, lines: Array<{ id: string, productId: string, productName: string, quantity: number, unitSalePrice: string, unitCostSnapshot: string | null, currency: string, lineTotal: string }>, buyer: { name: string, email: string, phone: string, recipientName: string, recipientTaxId: string, addressLine: string, commune: string, region: string, deliveryNotes: string, taxId: string, taxName: string, taxActivity: string, taxAddress: string, taxCommune: string, taxRegion: string, taxEmail: string } | null, payment: { id: string, method: string, status: string, amount: string, currency: string, feeRequested: string, feeReported: string | null, refundedAmount: string, provider: string, providerPaymentId: string, paidAt: unknown, note: string, proof: { id: string, fileName: string, contentType: string, signedUrl: string | null, uploadedAt: unknown, rejectionReason: string, status: string } | null } | null, timeline: Array<{ id: string, eventType: string, title: string, detail: string, createdAt: unknown }>, reconciliationIssues: Array<{ id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean }>, shipment: { id: string, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null } | null } } };

export type OperationRetryReconciliationMutationVariables = Exact<{
  issueId: string | number;
  idempotencyKey: string;
}>;


export type OperationRetryReconciliationMutation = { retryReconciliation: { replayed: boolean, issue: { id: string, kind: string, status: string, summary: string, details: unknown, retryCount: number, lastAttemptAt: unknown, createdAt: unknown, resolvedAt: unknown, orderId: string | null, orderNumber: string | null, providerReference: string | null, canRetry: boolean } } };

export type OperationShipmentLabelFragment = { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string };

export type OperationShipmentSummaryFragment = { id: string, number: string, status: string, statusLabel: string, deliveryMode: string, recipientName: string, commune: string, region: string, carrier: string, trackingCode: string, trackingUrl: string, allowedActions: Array<string>, dispatchedAt: unknown, deliveredAt: unknown, createdAt: unknown, order: { id: string, number: string, status: string } };

export type OperationShipmentDetailFragment = { recipientTaxId: string, addressLine: string, deliveryNotes: string, dispatchNote: string, buyerEmail: string, updatedAt: unknown, id: string, number: string, status: string, statusLabel: string, deliveryMode: string, recipientName: string, commune: string, region: string, carrier: string, trackingCode: string, trackingUrl: string, allowedActions: Array<string>, dispatchedAt: unknown, deliveredAt: unknown, createdAt: unknown, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null, order: { id: string, number: string, status: string } };

export type OperationShippingDashboardQueryVariables = Exact<{ [key: string]: never; }>;


export type OperationShippingDashboardQuery = { shippingDashboard: { total: number, pending: number, dispatched: number, delivered: number } };

export type OperationShipmentsQueryVariables = Exact<{
  filter?: OperationShipmentFilterInput | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type OperationShipmentsQuery = { shipments: { totalCount: number, pageInfo: { hasNextPage: boolean, endCursor: string }, nodes: Array<{ id: string, number: string, status: string, statusLabel: string, deliveryMode: string, recipientName: string, commune: string, region: string, carrier: string, trackingCode: string, trackingUrl: string, allowedActions: Array<string>, dispatchedAt: unknown, deliveredAt: unknown, createdAt: unknown, order: { id: string, number: string, status: string } }> } };

export type OperationShipmentQueryVariables = Exact<{
  id: string | number;
}>;


export type OperationShipmentQuery = { shipment: { recipientTaxId: string, addressLine: string, deliveryNotes: string, dispatchNote: string, buyerEmail: string, updatedAt: unknown, id: string, number: string, status: string, statusLabel: string, deliveryMode: string, recipientName: string, commune: string, region: string, carrier: string, trackingCode: string, trackingUrl: string, allowedActions: Array<string>, dispatchedAt: unknown, deliveredAt: unknown, createdAt: unknown, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null, order: { id: string, number: string, status: string } } | null };

export type OperationRegisterShipmentDispatchMutationVariables = Exact<{
  shipmentId: string | number;
  input: OperationRegisterShipmentDispatchInput;
  idempotencyKey: string;
}>;


export type OperationRegisterShipmentDispatchMutation = { registerShipmentDispatch: { replayed: boolean, shipment: { recipientTaxId: string, addressLine: string, deliveryNotes: string, dispatchNote: string, buyerEmail: string, updatedAt: unknown, id: string, number: string, status: string, statusLabel: string, deliveryMode: string, recipientName: string, commune: string, region: string, carrier: string, trackingCode: string, trackingUrl: string, allowedActions: Array<string>, dispatchedAt: unknown, deliveredAt: unknown, createdAt: unknown, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null, order: { id: string, number: string, status: string } } } };

export type OperationGenerateShipmentLabelMutationVariables = Exact<{
  shipmentId: string | number;
  idempotencyKey: string;
}>;


export type OperationGenerateShipmentLabelMutation = { generateShipmentLabel: { replayed: boolean, label: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string }, shipment: { recipientTaxId: string, addressLine: string, deliveryNotes: string, dispatchNote: string, buyerEmail: string, updatedAt: unknown, id: string, number: string, status: string, statusLabel: string, deliveryMode: string, recipientName: string, commune: string, region: string, carrier: string, trackingCode: string, trackingUrl: string, allowedActions: Array<string>, dispatchedAt: unknown, deliveredAt: unknown, createdAt: unknown, latestLabel: { id: string, downloadUrl: string | null, expiresAt: unknown, createdAt: unknown, fileName: string } | null, order: { id: string, number: string, status: string } } } };

export const ProductRowFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}}]} as unknown as DocumentNode<OperationProductRowFragment, unknown>;
export const StockMovementRowFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StockMovementRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StockMovementType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"movementType"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"balanceAfter"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"actorName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<OperationStockMovementRowFragment, unknown>;
export const CustomFieldDefinitionFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomFieldDefinition"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomFieldType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"fieldType"}},{"kind":"Field","name":{"kind":"Name","value":"helpText"}},{"kind":"Field","name":{"kind":"Name","value":"isRequired"}},{"kind":"Field","name":{"kind":"Name","value":"isVisible"}},{"kind":"Field","name":{"kind":"Name","value":"isFilterable"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]} as unknown as DocumentNode<OperationCustomFieldDefinitionFragment, unknown>;
export const ProductMediaFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductMedia"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductMediaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"mediumUrl"}},{"kind":"Field","name":{"kind":"Name","value":"largeUrl"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<OperationProductMediaFragment, unknown>;
export const InventoryAlertFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryAlert"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryAlertType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"alertType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"threshold"}},{"kind":"Field","name":{"kind":"Name","value":"availableQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"openedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<OperationInventoryAlertFragment, unknown>;
export const InventoryImportJobFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryImportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryImportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"sourceFileName"}},{"kind":"Field","name":{"kind":"Name","value":"headers"}},{"kind":"Field","name":{"kind":"Name","value":"previewRows"}},{"kind":"Field","name":{"kind":"Name","value":"mapping"}},{"kind":"Field","name":{"kind":"Name","value":"rowErrors"}},{"kind":"Field","name":{"kind":"Name","value":"totalRows"}},{"kind":"Field","name":{"kind":"Name","value":"processedRows"}},{"kind":"Field","name":{"kind":"Name","value":"createdCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"reportUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationInventoryImportJobFragment, unknown>;
export const InventoryExportJobFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryExportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryExportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"fileFormat"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"rowCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationInventoryExportJobFragment, unknown>;
export const SellerOrderSummaryFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<OperationSellerOrderSummaryFragment, unknown>;
export const OrderLineFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}}]} as unknown as DocumentNode<OperationOrderLineFragment, unknown>;
export const BuyerSnapshotFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}}]} as unknown as DocumentNode<OperationBuyerSnapshotFragment, unknown>;
export const PaymentProofFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]} as unknown as DocumentNode<OperationPaymentProofFragment, unknown>;
export const PaymentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]} as unknown as DocumentNode<OperationPaymentFragment, unknown>;
export const OrderTimelineFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<OperationOrderTimelineFragment, unknown>;
export const ReconciliationIssueFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}}]} as unknown as DocumentNode<OperationReconciliationIssueFragment, unknown>;
export const ShipmentLabelFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}}]} as unknown as DocumentNode<OperationShipmentLabelFragment, unknown>;
export const SellerOrderFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}}]} as unknown as DocumentNode<OperationSellerOrderFragment, unknown>;
export const PublicSellerFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicSeller"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicSellerType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"businessEmail"}},{"kind":"Field","name":{"kind":"Name","value":"logoUrl"}}]}}]} as unknown as DocumentNode<OperationPublicSellerFragment, unknown>;
export const PublicOrderLineFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicOrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicOrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"photos"}},{"kind":"Field","name":{"kind":"Name","value":"attributes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]} as unknown as DocumentNode<OperationPublicOrderLineFragment, unknown>;
export const PublicOrderFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicOrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"paymentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"availablePaymentMethods"}},{"kind":"Field","name":{"kind":"Name","value":"bankTransferInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"bankDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bankName"}},{"kind":"Field","name":{"kind":"Name","value":"accountType"}},{"kind":"Field","name":{"kind":"Name","value":"accountTypeLabel"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"confirmationEmail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"isExpired"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"seller"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicSeller"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicOrderLine"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicSeller"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicSellerType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"businessEmail"}},{"kind":"Field","name":{"kind":"Name","value":"logoUrl"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicOrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicOrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"photos"}},{"kind":"Field","name":{"kind":"Name","value":"attributes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]} as unknown as DocumentNode<OperationPublicOrderFragment, unknown>;
export const ShipmentSummaryFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"carrier"}},{"kind":"Field","name":{"kind":"Name","value":"trackingCode"}},{"kind":"Field","name":{"kind":"Name","value":"trackingUrl"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deliveredAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<OperationShipmentSummaryFragment, unknown>;
export const ShipmentDetailFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentDetail"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentSummary"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchNote"}},{"kind":"Field","name":{"kind":"Name","value":"buyerEmail"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"carrier"}},{"kind":"Field","name":{"kind":"Name","value":"trackingCode"}},{"kind":"Field","name":{"kind":"Name","value":"trackingUrl"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deliveredAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}}]} as unknown as DocumentNode<OperationShipmentDetailFragment, unknown>;
export const UpdateProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProfileInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fullName"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}}]}}]}}]}}]} as unknown as DocumentNode<OperationUpdateProfileMutation, OperationUpdateProfileMutationVariables>;
export const UpdateOrganisationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateOrganisation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateOrganisationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateOrganisation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"organisation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"businessEmail"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"logoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bankName"}},{"kind":"Field","name":{"kind":"Name","value":"bankAccountType"}},{"kind":"Field","name":{"kind":"Name","value":"bankAccountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"bankHolderTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"bankConfirmationEmail"}},{"kind":"Field","name":{"kind":"Name","value":"hasBankDetails"}}]}}]}}]}}]} as unknown as DocumentNode<OperationUpdateOrganisationMutation, OperationUpdateOrganisationMutationVariables>;
export const InventorySchemaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InventorySchema"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeInactive"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inventorySchema"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"includeInactive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeInactive"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inventoryId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"maxActiveFields"}},{"kind":"Field","name":{"kind":"Name","value":"fields"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomFieldDefinition"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomFieldDefinition"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomFieldType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"fieldType"}},{"kind":"Field","name":{"kind":"Name","value":"helpText"}},{"kind":"Field","name":{"kind":"Name","value":"isRequired"}},{"kind":"Field","name":{"kind":"Name","value":"isVisible"}},{"kind":"Field","name":{"kind":"Name","value":"isFilterable"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]} as unknown as DocumentNode<OperationInventorySchemaQuery, OperationInventorySchemaQueryVariables>;
export const InventoryDashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InventoryDashboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inventoryDashboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"productCount"}},{"kind":"Field","name":{"kind":"Name","value":"archivedCount"}},{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"outOfStockCount"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockCount"}},{"kind":"Field","name":{"kind":"Name","value":"alerts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryAlert"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recentMovements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StockMovementRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryAlert"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryAlertType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"alertType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"threshold"}},{"kind":"Field","name":{"kind":"Name","value":"availableQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"openedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StockMovementRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StockMovementType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"movementType"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"balanceAfter"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"actorName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<OperationInventoryDashboardQuery, OperationInventoryDashboardQueryVariables>;
export const ProductsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Products"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ProductFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sort"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"descending"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"products"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sort"}}},{"kind":"Argument","name":{"kind":"Name","value":"descending"},"value":{"kind":"Variable","name":{"kind":"Name","value":"descending"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}}]} as unknown as DocumentNode<OperationProductsQuery, OperationProductsQueryVariables>;
export const ProductDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProductDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"product"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductRow"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductMedia"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"productStockBreakdown"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"effectivePrice"}},{"kind":"Field","name":{"kind":"Name","value":"buyerName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"referenceId"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"productOrders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"availableFromStage"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"buyerName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"productShipments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"availableFromStage"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductMedia"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductMediaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"mediumUrl"}},{"kind":"Field","name":{"kind":"Name","value":"largeUrl"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<OperationProductDetailQuery, OperationProductDetailQueryVariables>;
export const ProductBreakdownDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProductBreakdown"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"productId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"productStockBreakdown"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"productId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"effectivePrice"}},{"kind":"Field","name":{"kind":"Name","value":"buyerName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"referenceId"}}]}}]}}]}}]} as unknown as DocumentNode<OperationProductBreakdownQuery, OperationProductBreakdownQueryVariables>;
export const ProductMovementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProductMovements"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"productId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stockMovements"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"productId"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StockMovementRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StockMovementRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StockMovementType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"movementType"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"balanceAfter"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"actorName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<OperationProductMovementsQuery, OperationProductMovementsQueryVariables>;
export const CreateProductDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateProduct"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateProductInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createProduct"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"product"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductRow"}}]}},{"kind":"Field","name":{"kind":"Name","value":"movement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StockMovementRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StockMovementRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StockMovementType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"movementType"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"balanceAfter"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"actorName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<OperationCreateProductMutation, OperationCreateProductMutationVariables>;
export const UpdateProductDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProduct"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProductInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProduct"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"product"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}}]} as unknown as DocumentNode<OperationUpdateProductMutation, OperationUpdateProductMutationVariables>;
export const RecordStockMovementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RecordStockMovement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordStockMovementInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordStockMovement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"movement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StockMovementRow"}}]}},{"kind":"Field","name":{"kind":"Name","value":"product"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StockMovementRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StockMovementType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"movementType"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"balanceAfter"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"actorName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}}]} as unknown as DocumentNode<OperationRecordStockMovementMutation, OperationRecordStockMovementMutationVariables>;
export const ArchiveProductDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ArchiveProduct"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"productId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"archiveProduct"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"productId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"product"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}}]} as unknown as DocumentNode<OperationArchiveProductMutation, OperationArchiveProductMutationVariables>;
export const RestoreProductDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RestoreProduct"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"productId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restoreProduct"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"productId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"product"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}}]} as unknown as DocumentNode<OperationRestoreProductMutation, OperationRestoreProductMutationVariables>;
export const CreateCustomFieldDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateCustomField"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateCustomFieldInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createCustomField"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomFieldDefinition"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomFieldDefinition"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomFieldType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"fieldType"}},{"kind":"Field","name":{"kind":"Name","value":"helpText"}},{"kind":"Field","name":{"kind":"Name","value":"isRequired"}},{"kind":"Field","name":{"kind":"Name","value":"isVisible"}},{"kind":"Field","name":{"kind":"Name","value":"isFilterable"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]} as unknown as DocumentNode<OperationCreateCustomFieldMutation, OperationCreateCustomFieldMutationVariables>;
export const UpdateCustomFieldDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateCustomField"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateCustomFieldInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateCustomField"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"field"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomFieldDefinition"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomFieldDefinition"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomFieldType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"fieldType"}},{"kind":"Field","name":{"kind":"Name","value":"helpText"}},{"kind":"Field","name":{"kind":"Name","value":"isRequired"}},{"kind":"Field","name":{"kind":"Name","value":"isVisible"}},{"kind":"Field","name":{"kind":"Name","value":"isFilterable"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]} as unknown as DocumentNode<OperationUpdateCustomFieldMutation, OperationUpdateCustomFieldMutationVariables>;
export const ReorderCustomFieldsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReorderCustomFields"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fieldIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reorderCustomFields"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"fieldIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fieldIds"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fields"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"CustomFieldDefinition"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"CustomFieldDefinition"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CustomFieldType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"fieldType"}},{"kind":"Field","name":{"kind":"Name","value":"helpText"}},{"kind":"Field","name":{"kind":"Name","value":"isRequired"}},{"kind":"Field","name":{"kind":"Name","value":"isVisible"}},{"kind":"Field","name":{"kind":"Name","value":"isFilterable"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]} as unknown as DocumentNode<OperationReorderCustomFieldsMutation, OperationReorderCustomFieldsMutationVariables>;
export const InventoryImportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InventoryImport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inventoryImport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryImportJob"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryImportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryImportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"sourceFileName"}},{"kind":"Field","name":{"kind":"Name","value":"headers"}},{"kind":"Field","name":{"kind":"Name","value":"previewRows"}},{"kind":"Field","name":{"kind":"Name","value":"mapping"}},{"kind":"Field","name":{"kind":"Name","value":"rowErrors"}},{"kind":"Field","name":{"kind":"Name","value":"totalRows"}},{"kind":"Field","name":{"kind":"Name","value":"processedRows"}},{"kind":"Field","name":{"kind":"Name","value":"createdCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"reportUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationInventoryImportQuery, OperationInventoryImportQueryVariables>;
export const InventoryImportsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InventoryImports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inventoryImports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryImportJob"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryImportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryImportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"sourceFileName"}},{"kind":"Field","name":{"kind":"Name","value":"headers"}},{"kind":"Field","name":{"kind":"Name","value":"previewRows"}},{"kind":"Field","name":{"kind":"Name","value":"mapping"}},{"kind":"Field","name":{"kind":"Name","value":"rowErrors"}},{"kind":"Field","name":{"kind":"Name","value":"totalRows"}},{"kind":"Field","name":{"kind":"Name","value":"processedRows"}},{"kind":"Field","name":{"kind":"Name","value":"createdCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"reportUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationInventoryImportsQuery, OperationInventoryImportsQueryVariables>;
export const InventoryExportsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InventoryExports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inventoryExports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryExportJob"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryExportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryExportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"fileFormat"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"rowCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationInventoryExportsQuery, OperationInventoryExportsQueryVariables>;
export const InventoryImportTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"InventoryImportTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"inventoryImportTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"contentBase64"}},{"kind":"Field","name":{"kind":"Name","value":"columns"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"destination"}},{"kind":"Field","name":{"kind":"Name","value":"header"}},{"kind":"Field","name":{"kind":"Name","value":"required"}}]}}]}}]}}]} as unknown as DocumentNode<OperationInventoryImportTemplateQuery, OperationInventoryImportTemplateQueryVariables>;
export const AttachProductMediaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AttachProductMedia"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"productId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"makePrimary"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attachProductMedia"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"productId"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}}},{"kind":"Argument","name":{"kind":"Name","value":"makePrimary"},"value":{"kind":"Variable","name":{"kind":"Name","value":"makePrimary"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductMedia"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductMedia"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductMediaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"mediumUrl"}},{"kind":"Field","name":{"kind":"Name","value":"largeUrl"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<OperationAttachProductMediaMutation, OperationAttachProductMediaMutationVariables>;
export const SetPrimaryProductMediaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetPrimaryProductMedia"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"productId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setPrimaryProductMedia"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"productId"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"media"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductMedia"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductMedia"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductMediaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assetId"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"mediumUrl"}},{"kind":"Field","name":{"kind":"Name","value":"largeUrl"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<OperationSetPrimaryProductMediaMutation, OperationSetPrimaryProductMediaMutationVariables>;
export const RemoveProductMediaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveProductMedia"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"productId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeProductMedia"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"productId"}}},{"kind":"Argument","name":{"kind":"Name","value":"assetId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"product"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}}]} as unknown as DocumentNode<OperationRemoveProductMediaMutation, OperationRemoveProductMediaMutationVariables>;
export const StartInventoryImportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartInventoryImport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startInventoryImport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assetId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assetId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importJob"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryImportJob"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryImportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryImportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"sourceFileName"}},{"kind":"Field","name":{"kind":"Name","value":"headers"}},{"kind":"Field","name":{"kind":"Name","value":"previewRows"}},{"kind":"Field","name":{"kind":"Name","value":"mapping"}},{"kind":"Field","name":{"kind":"Name","value":"rowErrors"}},{"kind":"Field","name":{"kind":"Name","value":"totalRows"}},{"kind":"Field","name":{"kind":"Name","value":"processedRows"}},{"kind":"Field","name":{"kind":"Name","value":"createdCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"reportUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationStartInventoryImportMutation, OperationStartInventoryImportMutationVariables>;
export const PreviewInventoryImportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PreviewInventoryImport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"importId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mapping"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSONString"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"previewInventoryImport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"importId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"importId"}}},{"kind":"Argument","name":{"kind":"Name","value":"mapping"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mapping"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importJob"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryImportJob"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryImportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryImportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"sourceFileName"}},{"kind":"Field","name":{"kind":"Name","value":"headers"}},{"kind":"Field","name":{"kind":"Name","value":"previewRows"}},{"kind":"Field","name":{"kind":"Name","value":"mapping"}},{"kind":"Field","name":{"kind":"Name","value":"rowErrors"}},{"kind":"Field","name":{"kind":"Name","value":"totalRows"}},{"kind":"Field","name":{"kind":"Name","value":"processedRows"}},{"kind":"Field","name":{"kind":"Name","value":"createdCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"reportUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationPreviewInventoryImportMutation, OperationPreviewInventoryImportMutationVariables>;
export const ConfirmInventoryImportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmInventoryImport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"importId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmInventoryImport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"importId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"importId"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"importJob"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryImportJob"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryImportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryImportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"sourceFileName"}},{"kind":"Field","name":{"kind":"Name","value":"headers"}},{"kind":"Field","name":{"kind":"Name","value":"previewRows"}},{"kind":"Field","name":{"kind":"Name","value":"mapping"}},{"kind":"Field","name":{"kind":"Name","value":"rowErrors"}},{"kind":"Field","name":{"kind":"Name","value":"totalRows"}},{"kind":"Field","name":{"kind":"Name","value":"processedRows"}},{"kind":"Field","name":{"kind":"Name","value":"createdCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"reportUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationConfirmInventoryImportMutation, OperationConfirmInventoryImportMutationVariables>;
export const RetryInventoryImportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetryInventoryImport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"importId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retryInventoryImport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"importId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"importId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"importJob"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryImportJob"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryImportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryImportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"sourceFileName"}},{"kind":"Field","name":{"kind":"Name","value":"headers"}},{"kind":"Field","name":{"kind":"Name","value":"previewRows"}},{"kind":"Field","name":{"kind":"Name","value":"mapping"}},{"kind":"Field","name":{"kind":"Name","value":"rowErrors"}},{"kind":"Field","name":{"kind":"Name","value":"totalRows"}},{"kind":"Field","name":{"kind":"Name","value":"processedRows"}},{"kind":"Field","name":{"kind":"Name","value":"createdCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"reportUrl"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationRetryInventoryImportMutation, OperationRetryInventoryImportMutationVariables>;
export const StartInventoryExportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartInventoryExport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fileFormat"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ProductFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startInventoryExport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"fileFormat"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fileFormat"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"exportJob"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryExportJob"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryExportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryExportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"fileFormat"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"rowCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationStartInventoryExportMutation, OperationStartInventoryExportMutationVariables>;
export const RetryInventoryExportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetryInventoryExport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"exportId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retryInventoryExport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"exportId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"exportId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportJob"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InventoryExportJob"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InventoryExportJob"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"InventoryExportType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"fileFormat"}},{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"rowCount"}},{"kind":"Field","name":{"kind":"Name","value":"errorCode"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}}]}}]} as unknown as DocumentNode<OperationRetryInventoryExportMutation, OperationRetryInventoryExportMutationVariables>;
export const UpdateInventoryLowStockThresholdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateInventoryLowStockThreshold"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"threshold"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateInventoryLowStockThreshold"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"threshold"},"value":{"kind":"Variable","name":{"kind":"Name","value":"threshold"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"threshold"}}]}}]}}]} as unknown as DocumentNode<OperationUpdateInventoryLowStockThresholdMutation, OperationUpdateInventoryLowStockThresholdMutationVariables>;
export const UpdateProductLowStockThresholdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProductLowStockThreshold"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"productId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"threshold"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clear"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProductLowStockThreshold"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"productId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"productId"}}},{"kind":"Argument","name":{"kind":"Name","value":"threshold"},"value":{"kind":"Variable","name":{"kind":"Name","value":"threshold"}}},{"kind":"Argument","name":{"kind":"Name","value":"clear"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clear"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"product"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ProductRow"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ProductRow"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ProductType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"catalogStatus"}},{"kind":"Field","name":{"kind":"Name","value":"purchasePrice"}},{"kind":"Field","name":{"kind":"Name","value":"salePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"extraAttributes"}},{"kind":"Field","name":{"kind":"Name","value":"lowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"effectiveLowStockThreshold"}},{"kind":"Field","name":{"kind":"Name","value":"archivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"stock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"onHand"}},{"kind":"Field","name":{"kind":"Name","value":"reserved"}},{"kind":"Field","name":{"kind":"Name","value":"available"}},{"kind":"Field","name":{"kind":"Name","value":"activeFulfilment"}}]}}]}}]} as unknown as DocumentNode<OperationUpdateProductLowStockThresholdMutation, OperationUpdateProductLowStockThresholdMutationVariables>;
export const SellerPaymentConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SellerPaymentConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sellerPaymentConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"providerAccountId"}},{"kind":"Field","name":{"kind":"Name","value":"scopes"}},{"kind":"Field","name":{"kind":"Name","value":"tokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"connectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"disconnectedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"paymentCommissionConfiguration"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"rate"}},{"kind":"Field","name":{"kind":"Name","value":"minimum"}},{"kind":"Field","name":{"kind":"Name","value":"zeroFeeEnabled"}}]}}]}}]} as unknown as DocumentNode<OperationSellerPaymentConnectionQuery, OperationSellerPaymentConnectionQueryVariables>;
export const StartMercadoPagoConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartMercadoPagoConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startMercadoPagoConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"authorizationUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}}]}}]} as unknown as DocumentNode<OperationStartMercadoPagoConnectionMutation, OperationStartMercadoPagoConnectionMutationVariables>;
export const DisconnectMercadoPagoConnectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DisconnectMercadoPagoConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"disconnectMercadoPagoConnection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"disconnectedAt"}}]}}]}}]}}]} as unknown as DocumentNode<OperationDisconnectMercadoPagoConnectionMutation, OperationDisconnectMercadoPagoConnectionMutationVariables>;
export const SalesDashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SalesDashboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"salesDashboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalOrders"}},{"kind":"Field","name":{"kind":"Name","value":"activeOrders"}},{"kind":"Field","name":{"kind":"Name","value":"awaitingBuyer"}},{"kind":"Field","name":{"kind":"Name","value":"awaitingPayment"}},{"kind":"Field","name":{"kind":"Name","value":"awaitingValidation"}},{"kind":"Field","name":{"kind":"Name","value":"paidOrders"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"confirmedGross"}}]}}]}}]} as unknown as DocumentNode<OperationSalesDashboardQuery, OperationSalesDashboardQueryVariables>;
export const OrdersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Orders"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"orders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<OperationOrdersQuery, OperationOrdersQueryVariables>;
export const OrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Order"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"order"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationOrderQuery, OperationOrderQueryVariables>;
export const PublicOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicOrder"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicSeller"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicSellerType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"businessEmail"}},{"kind":"Field","name":{"kind":"Name","value":"logoUrl"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicOrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicOrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"photos"}},{"kind":"Field","name":{"kind":"Name","value":"attributes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicOrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"paymentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"availablePaymentMethods"}},{"kind":"Field","name":{"kind":"Name","value":"bankTransferInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"bankDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bankName"}},{"kind":"Field","name":{"kind":"Name","value":"accountType"}},{"kind":"Field","name":{"kind":"Name","value":"accountTypeLabel"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"confirmationEmail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"isExpired"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"seller"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicSeller"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicOrderLine"}}]}}]}}]} as unknown as DocumentNode<OperationPublicOrderQuery, OperationPublicOrderQueryVariables>;
export const PublicOrderStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicOrderStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicOrderStatus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"paymentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"isExpired"}}]}}]}}]} as unknown as DocumentNode<OperationPublicOrderStatusQuery, OperationPublicOrderStatusQueryVariables>;
export const SalesBalanceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SalesBalance"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SalesBalanceFilterInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"salesBalance"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"confirmedGross"}},{"kind":"Field","name":{"kind":"Name","value":"refunds"}},{"kind":"Field","name":{"kind":"Name","value":"netSales"}},{"kind":"Field","name":{"kind":"Name","value":"knownCogs"}},{"kind":"Field","name":{"kind":"Name","value":"grossMargin"}},{"kind":"Field","name":{"kind":"Name","value":"pendingAmount"}},{"kind":"Field","name":{"kind":"Name","value":"validationAmount"}},{"kind":"Field","name":{"kind":"Name","value":"operations"}},{"kind":"Field","name":{"kind":"Name","value":"recognizedLines"}},{"kind":"Field","name":{"kind":"Name","value":"knownCostLines"}},{"kind":"Field","name":{"kind":"Name","value":"costCoverage"}},{"kind":"Field","name":{"kind":"Name","value":"costIncomplete"}},{"kind":"Field","name":{"kind":"Name","value":"inventoryAtCost"}},{"kind":"Field","name":{"kind":"Name","value":"inventoryAtSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"inventoryPotentialMargin"}},{"kind":"Field","name":{"kind":"Name","value":"inventoryValuationIncomplete"}}]}}]}}]} as unknown as DocumentNode<OperationSalesBalanceQuery, OperationSalesBalanceQueryVariables>;
export const SalesBalanceBreakdownDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SalesBalanceBreakdown"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SalesBalanceFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"salesBalanceBreakdown"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"period"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"confirmedGross"}},{"kind":"Field","name":{"kind":"Name","value":"refunds"}},{"kind":"Field","name":{"kind":"Name","value":"netSales"}},{"kind":"Field","name":{"kind":"Name","value":"knownCogs"}},{"kind":"Field","name":{"kind":"Name","value":"grossMargin"}},{"kind":"Field","name":{"kind":"Name","value":"recognizedLines"}},{"kind":"Field","name":{"kind":"Name","value":"knownCostLines"}},{"kind":"Field","name":{"kind":"Name","value":"costIncomplete"}}]}}]}}]}}]} as unknown as DocumentNode<OperationSalesBalanceBreakdownQuery, OperationSalesBalanceBreakdownQueryVariables>;
export const ReconciliationIssuesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ReconciliationIssues"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}}]} as unknown as DocumentNode<OperationReconciliationIssuesQuery, OperationReconciliationIssuesQueryVariables>;
export const CreateOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateOrderInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationCreateOrderMutation, OperationCreateOrderMutationVariables>;
export const PublishOrderLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishOrderLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishOrderLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationPublishOrderLinkMutation, OperationPublishOrderLinkMutationVariables>;
export const SetBuyerDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetBuyerDetails"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerDetailsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setBuyerDetails"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicSeller"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicSellerType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"businessEmail"}},{"kind":"Field","name":{"kind":"Name","value":"logoUrl"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicOrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicOrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"photos"}},{"kind":"Field","name":{"kind":"Name","value":"attributes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PublicOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PublicOrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"paymentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"availablePaymentMethods"}},{"kind":"Field","name":{"kind":"Name","value":"bankTransferInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"bankDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bankName"}},{"kind":"Field","name":{"kind":"Name","value":"accountType"}},{"kind":"Field","name":{"kind":"Name","value":"accountTypeLabel"}},{"kind":"Field","name":{"kind":"Name","value":"accountNumber"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"confirmationEmail"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"isExpired"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"seller"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicSeller"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PublicOrderLine"}}]}}]}}]} as unknown as DocumentNode<OperationSetBuyerDetailsMutation, OperationSetBuyerDetailsMutationVariables>;
export const UpdateOrderBuyerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateOrderBuyer"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerDetailsInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateOrderBuyer"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationUpdateOrderBuyerMutation, OperationUpdateOrderBuyerMutationVariables>;
export const InitiateMercadoPagoCheckoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InitiateMercadoPagoCheckout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"initiateMercadoPagoCheckout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkoutUrl"}},{"kind":"Field","name":{"kind":"Name","value":"replayed"}}]}}]}}]} as unknown as DocumentNode<OperationInitiateMercadoPagoCheckoutMutation, OperationInitiateMercadoPagoCheckoutMutationVariables>;
export const ReviewPaymentProofDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReviewPaymentProof"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"approved"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rejectionReason"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reviewPaymentProof"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"approved"},"value":{"kind":"Variable","name":{"kind":"Name","value":"approved"}}},{"kind":"Argument","name":{"kind":"Name","value":"rejectionReason"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rejectionReason"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationReviewPaymentProofMutation, OperationReviewPaymentProofMutationVariables>;
export const ConfirmManualPaymentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmManualPayment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"amount"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"paidAt"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"note"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmManualPayment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"amount"},"value":{"kind":"Variable","name":{"kind":"Name","value":"amount"}}},{"kind":"Argument","name":{"kind":"Name","value":"paidAt"},"value":{"kind":"Variable","name":{"kind":"Name","value":"paidAt"}}},{"kind":"Argument","name":{"kind":"Name","value":"note"},"value":{"kind":"Variable","name":{"kind":"Name","value":"note"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationConfirmManualPaymentMutation, OperationConfirmManualPaymentMutationVariables>;
export const CancelOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reason"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"reason"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reason"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationCancelOrderMutation, OperationCancelOrderMutationVariables>;
export const RestoreOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RestoreOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restoreOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationRestoreOrderMutation, OperationRestoreOrderMutationVariables>;
export const RefundPaymentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefundPayment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reason"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refundPayment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"reason"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reason"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationRefundPaymentMutation, OperationRefundPaymentMutationVariables>;
export const ResendOrderLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendOrderLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resendOrderLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationResendOrderLinkMutation, OperationResendOrderLinkMutationVariables>;
export const SendOfferLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SendOfferLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sendOfferLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationSendOfferLinkMutation, OperationSendOfferLinkMutationVariables>;
export const ReissueBankTransferOfferDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReissueBankTransferOffer"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reissueBankTransferOffer"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrder"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrderSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"paymentMethod"}},{"kind":"Field","name":{"kind":"Name","value":"nextAction"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationRequired"}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationStatus"}},{"kind":"Field","name":{"kind":"Name","value":"reservationExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderLine"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderItemType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"productId"}},{"kind":"Field","name":{"kind":"Name","value":"productName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitSalePrice"}},{"kind":"Field","name":{"kind":"Name","value":"unitCostSnapshot"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BuyerSnapshot"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BuyerSnapshotType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"taxId"}},{"kind":"Field","name":{"kind":"Name","value":"taxName"}},{"kind":"Field","name":{"kind":"Name","value":"taxActivity"}},{"kind":"Field","name":{"kind":"Name","value":"taxAddress"}},{"kind":"Field","name":{"kind":"Name","value":"taxCommune"}},{"kind":"Field","name":{"kind":"Name","value":"taxRegion"}},{"kind":"Field","name":{"kind":"Name","value":"taxEmail"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PaymentProof"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentProofType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"contentType"}},{"kind":"Field","name":{"kind":"Name","value":"signedUrl"}},{"kind":"Field","name":{"kind":"Name","value":"uploadedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Payment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PaymentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"feeRequested"}},{"kind":"Field","name":{"kind":"Name","value":"feeReported"}},{"kind":"Field","name":{"kind":"Name","value":"refundedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"providerPaymentId"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"note"}},{"kind":"Field","name":{"kind":"Name","value":"proof"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PaymentProof"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderTimeline"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderEventType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"eventType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SellerOrder"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"OrderType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SellerOrderSummary"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"publicUrl"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"publicTokenExpiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canViewCosts"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderLine"}}]}},{"kind":"Field","name":{"kind":"Name","value":"buyer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BuyerSnapshot"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"Payment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeline"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderTimeline"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reconciliationIssues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]}}]} as unknown as DocumentNode<OperationReissueBankTransferOfferMutation, OperationReissueBankTransferOfferMutationVariables>;
export const RetryReconciliationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RetryReconciliation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"issueId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"retryReconciliation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"issueId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"issueId"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"issue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReconciliationIssue"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReconciliationIssue"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ReconciliationIssueType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"details"}},{"kind":"Field","name":{"kind":"Name","value":"retryCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastAttemptAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderNumber"}},{"kind":"Field","name":{"kind":"Name","value":"providerReference"}},{"kind":"Field","name":{"kind":"Name","value":"canRetry"}}]}}]} as unknown as DocumentNode<OperationRetryReconciliationMutation, OperationRetryReconciliationMutationVariables>;
export const ShippingDashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ShippingDashboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shippingDashboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"pending"}},{"kind":"Field","name":{"kind":"Name","value":"dispatched"}},{"kind":"Field","name":{"kind":"Name","value":"delivered"}}]}}]}}]} as unknown as DocumentNode<OperationShippingDashboardQuery, OperationShippingDashboardQueryVariables>;
export const ShipmentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Shipments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentFilterInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shipments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentSummary"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"carrier"}},{"kind":"Field","name":{"kind":"Name","value":"trackingCode"}},{"kind":"Field","name":{"kind":"Name","value":"trackingUrl"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deliveredAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<OperationShipmentsQuery, OperationShipmentsQueryVariables>;
export const ShipmentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Shipment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shipment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentDetail"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"carrier"}},{"kind":"Field","name":{"kind":"Name","value":"trackingCode"}},{"kind":"Field","name":{"kind":"Name","value":"trackingUrl"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deliveredAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentDetail"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentSummary"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchNote"}},{"kind":"Field","name":{"kind":"Name","value":"buyerEmail"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]} as unknown as DocumentNode<OperationShipmentQuery, OperationShipmentQueryVariables>;
export const RegisterShipmentDispatchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterShipmentDispatch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shipmentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterShipmentDispatchInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerShipmentDispatch"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shipmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shipmentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentDetail"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"carrier"}},{"kind":"Field","name":{"kind":"Name","value":"trackingCode"}},{"kind":"Field","name":{"kind":"Name","value":"trackingUrl"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deliveredAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentDetail"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentSummary"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchNote"}},{"kind":"Field","name":{"kind":"Name","value":"buyerEmail"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]} as unknown as DocumentNode<OperationRegisterShipmentDispatchMutation, OperationRegisterShipmentDispatchMutationVariables>;
export const GenerateShipmentLabelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateShipmentLabel"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shipmentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateShipmentLabel"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shipmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shipmentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"idempotencyKey"},"value":{"kind":"Variable","name":{"kind":"Name","value":"idempotencyKey"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"replayed"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"shipment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentDetail"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"statusLabel"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryMode"}},{"kind":"Field","name":{"kind":"Name","value":"recipientName"}},{"kind":"Field","name":{"kind":"Name","value":"commune"}},{"kind":"Field","name":{"kind":"Name","value":"region"}},{"kind":"Field","name":{"kind":"Name","value":"carrier"}},{"kind":"Field","name":{"kind":"Name","value":"trackingCode"}},{"kind":"Field","name":{"kind":"Name","value":"trackingUrl"}},{"kind":"Field","name":{"kind":"Name","value":"allowedActions"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deliveredAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentLabel"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabelDocumentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShipmentDetail"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShipmentType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentSummary"}},{"kind":"Field","name":{"kind":"Name","value":"recipientTaxId"}},{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"deliveryNotes"}},{"kind":"Field","name":{"kind":"Name","value":"dispatchNote"}},{"kind":"Field","name":{"kind":"Name","value":"buyerEmail"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"latestLabel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShipmentLabel"}}]}}]}}]} as unknown as DocumentNode<OperationGenerateShipmentLabelMutation, OperationGenerateShipmentLabelMutationVariables>;