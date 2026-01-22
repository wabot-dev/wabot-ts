# Wabot Framework Improvement Plan

This document outlines the prioritized action items to improve the Wabot framework based on the comprehensive code review.

---

## Phase 1: Critical Fixes (Before Production)

### 1. ✅ Add Global Unhandled Rejection Handler
- **File:** `src/core/error/setupErrorHandlers.ts`
- **Action:** Add `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)`
- **Risk:** Without this, async errors crash silently
- **Status:** COMPLETED
- **Additional:** Added `IErrorMonitor` interface to Logger for external error monitoring (Sentry, etc.)

### 2. Fix Fire-and-Forget Promise in Chat Controller
- **File:** `src/feature/chat-controller/runChatControllers.ts:88`
- **Action:** Add `await` and wrap in try-catch
- **Current:** `chatController[channelMetadata.functionName](receivedMessage)` (no await)
- **Fix:** `await chatController[...](receivedMessage).catch(err => logger.error(err))`

### 3. Add Event Listener Cleanup for Channels
- **Files:**
  - `src/addon/chat-controller/cmd/CmdChannel.ts:34`
  - `src/addon/chat-controller/telegram/TelegramChannel.ts:17`
  - `src/feature/socket-controller/runSocketControllers.ts:127`
- **Action:** Implement `disconnect()` method on IChatChannel interface, remove listeners on cleanup

### 4. Fix Race Condition in PgRepositoryBase
- **File:** `src/feature/pg/PgRepositoryBase.ts:76-100`
- **Action:** Move `this.tableIsReady = true` inside the lock block (after table creation)
- **Current:** Flag set outside lock, TOCTOU vulnerability

### 5. Fix Chat Resolution Race Condition
- **File:** `src/feature/chat-controller/ChatResolver.ts:15-30`
- **Action:** Use PostgreSQL UPSERT (`INSERT ... ON CONFLICT DO NOTHING RETURNING *`) or serializable transaction
- **Risk:** Duplicate chats created for same connection

### 6. Add JSON.parse Error Handling in Adapters
- **Files:**
  - `src/addon/chat-bot/anthropic/AnthropicChatAdapter.ts:89`
  - `src/addon/chat-bot/google/GoogleChatAdapter.ts:87`
  - `src/addon/chat-bot/openai/OpenaiChatAdapter.ts` (verify)
  - `src/addon/chat-bot/deepseek/DeepSeekChatAdapter.ts` (verify)
- **Action:** Wrap `JSON.parse()` in try-catch, throw `CustomError` with context

### 7. Fix Silent Error Suppression
- **Files:**
  - `src/feature/async/JobScheduler.ts:47,70` - Add proper error recovery
  - `src/addon/chat-controller/cmd/CmdChannel.ts:104-105` - Remove empty catch, handle error
- **Action:** Either rethrow, recover gracefully, or mark job as failed

---

## Phase 2: Security Hardening

### 8. Add Function Call Whitelist to MindsetOperator
- **File:** `src/feature/mindset/MindsetOperator.ts:129-162`
- **Action:** Validate function name against registered tools before execution
- **Risk:** LLM prompt injection could call unintended functions

### 9. Fix Token Validation in Auth Middlewares
- **Files:**
  - `src/addon/auth/api-key/ApiKeyHandshakeGuardMiddleware.ts:24`
  - `src/addon/auth/jwt/JwtGuardMiddleware.ts:23-25`
- **Action:** Use proper regex or validate array length after split
- **Current:** `"Bearer extra parts"` passes validation incorrectly

### 10. Restrict CORS in Socket Server
- **File:** `src/feature/socket/SocketServerProvider.ts:27-29`
- **Action:** Make CORS configurable, default to restrictive policy
- **Current:** Allows `*` origin

### 11. Remove Sensitive Data from Logs
- **File:** `src/addon/chat-bot/anthropic/AnthropicChatAdapter.ts:39`
- **Action:** Redact system prompts and user messages from debug logs
- **Risk:** API keys, user data, system prompts exposed in logs

---

## Phase 3: Error Handling Standardization

### 12. Replace Generic Error with CustomError
- **Files:**
  - `src/feature/chat-bot/Chat.ts:52,67,75,81`
  - `src/feature/chat-bot/ChatItem.ts:23`
  - `src/feature/pg/PgCrudRepository.ts:68,96`
  - `src/core/entity/Entity.ts` (validation errors)
- **Action:** Use `CustomError` with proper `httpCode`, `code`, and `message`

### 13. Add Error Handling to Channel Message Callbacks
- **Files:**
  - `src/addon/chat-controller/whatsapp/WhatsAppChannel.ts:36-37`
  - `src/addon/chat-controller/telegram/TelegramChannel.ts`
  - `src/addon/chat-controller/socket/SocketChannel.ts`
- **Action:** Wrap callback execution in try-catch, log errors with context, send error response to user

### 14. Improve HTTP Error Responses
- **File:** `src/addon/chat-controller/whatsapp/cloud-api/WhatsAppReceiverByCloudApi.ts:54-57`
- **Action:** Return structured error response with error code and message

---

## Phase 4: Type Safety Improvements

### 15. Reduce `any` Usage in Core Files
- **Files (Priority):**
  - `src/feature/mindset/MindsetOperator.ts:18,152,164,193`
  - `src/feature/pg/withPgTransaction.ts:14,17,37,48`
  - `src/feature/chat-bot/metadata/IChatBotMetadata.ts:5`
- **Action:** Replace with proper generics or `unknown` with type guards

### 16. Reduce `any` Usage in Addon Files
- **Files:**
  - `src/addon/chat-controller/socket/SocketChannel.ts:38`
  - `src/feature/socket-controller/metadata/@onSocketEvent.ts:8`
  - `src/feature/rest-controller/runRestControllers.ts`
- **Action:** Define proper interface types

### 17. Fix Non-null Assertions
- **Files:**
  - `src/feature/rest-controller/metadata/RestControllerMetadataStore.ts:57`
  - `src/addon/chat-controller/whatsapp/WhatsAppSender.ts:100`
- **Action:** Add proper null checks or use optional chaining with fallback

---

## Phase 5: Architecture Refactoring

### 18. Split MindsetOperator into Smaller Classes
- **File:** `src/feature/mindset/MindsetOperator.ts`
- **Action:** Extract into:
  - `SystemPromptBuilder` - Generates system prompts
  - `ToolRegistry` - Manages tool registration
  - `FunctionExecutor` - Executes function calls
  - `MindsetOperator` - Orchestrates the above

### 19. Make ChatBot Configuration Flexible
- **File:** `src/feature/chat-bot/ChatBot.ts:29`
- **Action:** Make `findLastItems(16)` configurable via constructor or config
- **Current:** Hard-coded 16-item memory limit

### 20. Split IChannelMessage Interface
- **File:** `src/feature/chat-controller/IChannelMessage.ts`
- **Action:** Separate into:
  - `IChannelMessage` - Core message data
  - `IChannelMessageContext` - Reply callback, auth, injection instances

---

## Phase 6: Test Coverage

### 21. Add Unit Tests for ChatBot
- **File:** Create `src/feature/chat-bot/ChatBot.unit.test.ts`
- **Test Cases:**
  - Message processing loop
  - Memory retrieval and storage
  - LLM adapter integration
  - Error handling in process loop

### 22. Add Unit Tests for ChatResolver
- **File:** Create `src/feature/chat-controller/ChatResolver.unit.test.ts`
- **Test Cases:**
  - New chat creation
  - Existing chat resolution
  - Concurrent resolution (race condition)

### 23. Add Unit Tests for Chat Entity
- **File:** Create `src/feature/chat-bot/Chat.unit.test.ts`
- **Test Cases:**
  - Connection management (add, has, get)
  - Association management
  - Validation by type (PRIVATE vs GROUP)

### 24. Add Integration Tests for Channels
- **Files:** Create test files for each channel
  - `src/addon/chat-controller/telegram/TelegramChannel.integration.test.ts`
  - `src/addon/chat-controller/socket/SocketChannel.integration.test.ts`
  - `src/addon/chat-controller/cmd/CmdChannel.unit.test.ts`

### 25. Add Unit Tests for Auth Classes
- **Files:**
  - `src/core/auth/Auth.unit.test.ts`
  - `src/addon/auth/jwt/JwtGuardMiddleware.unit.test.ts`
  - `src/addon/auth/api-key/ApiKeyHandshakeGuardMiddleware.unit.test.ts`
- **Test Cases:**
  - Valid/invalid tokens
  - Malformed headers
  - State transitions (assign, override)

### 26. Add Unit Tests for MindsetOperator
- **File:** Create `src/feature/mindset/MindsetOperator.unit.test.ts`
- **Test Cases:**
  - System prompt generation
  - Tool registration
  - Function call execution
  - Malicious input handling

---

## Phase 7: Missing Features

### 27. Implement Graceful Shutdown
- **File:** Create `src/core/bootstrap/gracefulShutdown.ts`
- **Action:**
  - Handle SIGTERM, SIGINT signals
  - Stop accepting new messages
  - Wait for in-flight requests to complete
  - Close database connections
  - Mark running jobs as interrupted

### 28. Add Rate Limiting
- **File:** Create `src/feature/rate-limit/RateLimiter.ts`
- **Action:**
  - Implement token bucket or sliding window algorithm
  - Add `@rateLimit()` decorator for controllers
  - Configure per-channel limits

### 29. Add Message Deduplication
- **File:** Create `src/feature/chat-controller/MessageDeduplicator.ts`
- **Action:**
  - Store message IDs with TTL (Redis or in-memory)
  - Check for duplicates before processing
  - Add idempotency key support

### 30. Add Health Check Endpoints
- **File:** Create `src/feature/health/HealthController.ts`
- **Action:**
  - `/health` - Basic liveness check
  - `/health/ready` - Check database, external services
  - `/health/detailed` - Full status with component health

### 31. Add Configuration Validation at Startup
- **File:** Create `src/core/config/validateConfig.ts`
- **Action:**
  - Validate all channel configs before connecting
  - Validate environment variables exist
  - Fail fast with clear error messages

### 32. Add Retry Logic for LLM Calls
- **File:** `src/feature/chat-bot/ChatBot.ts`
- **Action:**
  - Implement exponential backoff for failed LLM calls
  - Configure max retries
  - Handle rate limit responses (429)

### 33. Add Audit Logging
- **File:** Create `src/core/audit/AuditLogger.ts`
- **Action:**
  - Log authentication attempts (success/failure)
  - Log chat access
  - Log administrative actions
  - Structured JSON format for analysis

---

## Phase 8: Code Quality

### 34. Remove console.log from Production Code
- **File:** `src/feature/pg/PgRepositoryBase.ts:122`
- **Action:** Replace with Logger.debug()

### 35. Fix TODO Comments
- **File:** `src/feature/rest-controller/metadata/RestControllerMetadataStore.ts:49`
- **Action:** Implement warning log when controller has no endpoints

### 36. Standardize Null Coalescing
- **Action:** Audit codebase for inconsistent `?? null` vs `?? undefined` usage
- **Standard:** Use `?? null` for intentional null, `?? undefined` for optional

---

## Implementation Timeline

| Phase | Items | Priority | Estimated Effort |
|-------|-------|----------|------------------|
| Phase 1 | 1-7 | 🔴 Critical | 2-3 days |
| Phase 2 | 8-11 | 🔴 Critical | 1-2 days |
| Phase 3 | 12-14 | 🟠 High | 1-2 days |
| Phase 4 | 15-17 | 🟠 High | 2-3 days |
| Phase 5 | 18-20 | 🟡 Medium | 3-4 days |
| Phase 6 | 21-26 | 🟠 High | 4-5 days |
| Phase 7 | 27-33 | 🟡 Medium | 5-7 days |
| Phase 8 | 34-36 | 🟢 Low | 1 day |

**Total Estimated Effort:** 20-27 days

---

## Success Criteria

- [ ] All critical issues (Phase 1-2) resolved
- [ ] No unhandled promise rejections in production
- [ ] Test coverage > 70% for core business logic
- [ ] Zero `any` types in core modules
- [ ] All security vulnerabilities addressed
- [ ] Health checks passing in staging environment
- [ ] Graceful shutdown verified with zero message loss
