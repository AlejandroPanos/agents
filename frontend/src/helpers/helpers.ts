import axios from "axios";

export type AgentProvider = "anthropic" | "openai" | "google" | "deepseek";
export type MessageRole = "user" | "assistant";

export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export interface AgentCreate {
  name: string;
  description?: string | null;
  system_prompt: string;
  provider: AgentProvider;
  model: string;
}

export interface AgentUpdate {
  name?: string;
  description?: string | null;
  system_prompt?: string;
  provider?: AgentProvider;
  model?: string;
}

export interface AgentResponse {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  provider: AgentProvider;
  model: string;
  temperature: number;
  max_tokens: number;
  created_at: string;
  updated_at: string;
}

export interface ModelOption {
  provider: string;
  model_id: string;
  display_name: string;
  max_output_tokens: number;
  max_temperature: number;
}

export interface ModelsResponse {
  models: ModelOption[];
}

export interface ConversationCreate {
  title?: string | null;
}

export interface ConversationResponse {
  id: string;
  agent_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface ConversationWithMessages extends ConversationResponse {
  messages: MessageResponse[];
}

export interface SendMessageRequest {
  content: string;
}

export interface SendMessageResponse {
  user_message: MessageResponse;
  assistant_message: MessageResponse;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface HealthResponse {
  app: string;
  status: string;
  version: string;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
  withCredentials: true,
});

export async function loginWithGoogle(idToken: string): Promise<UserProfile> {
  const { data } = await api.post<UserProfile>("/auth/google", { id_token: idToken });
  return data;
}

export async function getCurrentUser(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>("/auth/me");
  return data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

export async function createAgent(agent: AgentCreate): Promise<AgentResponse> {
  const { data } = await api.post<AgentResponse>("/agents", agent);
  return data;
}

export async function listAgents(params?: PaginationParams): Promise<AgentResponse[]> {
  const { data } = await api.get<AgentResponse[]>("/agents", { params });
  return data;
}

export async function getAgent(agentId: string): Promise<AgentResponse> {
  const { data } = await api.get<AgentResponse>(`/agents/${encodeURIComponent(agentId)}`);
  return data;
}

export async function updateAgent(
  agentId: string,
  changes: AgentUpdate,
): Promise<AgentResponse> {
  const { data } = await api.patch<AgentResponse>(
    `/agents/${encodeURIComponent(agentId)}`,
    changes,
  );
  return data;
}

export async function deleteAgent(agentId: string): Promise<void> {
  await api.delete(`/agents/${encodeURIComponent(agentId)}`);
}

export async function getModels(): Promise<ModelsResponse> {
  const { data } = await api.get<ModelsResponse>("/models");
  return data;
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>("/health/");
  return data;
}

export async function createConversation(
  agentId: string,
  conversation?: ConversationCreate,
): Promise<ConversationResponse> {
  const { data } = await api.post<ConversationResponse>(
    `/agents/${encodeURIComponent(agentId)}/conversations`,
    conversation,
  );
  return data;
}

export async function listConversations(
  agentId: string,
  params?: PaginationParams,
): Promise<ConversationResponse[]> {
  const { data } = await api.get<ConversationResponse[]>(
    `/agents/${encodeURIComponent(agentId)}/conversations`,
    { params },
  );
  return data;
}

export async function getConversation(
  conversationId: string,
): Promise<ConversationWithMessages> {
  const { data } = await api.get<ConversationWithMessages>(
    `/conversations/${encodeURIComponent(conversationId)}`,
  );
  return data;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await api.delete(`/conversations/${encodeURIComponent(conversationId)}`);
}

export async function sendMessage(
  conversationId: string,
  message: SendMessageRequest,
): Promise<SendMessageResponse> {
  const { data } = await api.post<SendMessageResponse>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    message,
  );
  return data;
}

export async function listMessages(
  conversationId: string,
  params?: PaginationParams,
): Promise<MessageResponse[]> {
  const { data } = await api.get<MessageResponse[]>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    { params },
  );
  return data;
}
