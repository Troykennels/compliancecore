export interface ApiResponse<T> {
  data: T;
  error: null | ApiError;
  meta: { requestId?: string; timestamp?: string };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  data: T[];
  error: null;
  meta: {
    requestId?: string;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
