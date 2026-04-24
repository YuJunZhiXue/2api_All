package gateway

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature *float64      `json:"temperature,omitempty"`
	Stream      bool          `json:"stream,omitempty"`
	LogitBias   interface{}   `json:"logit_bias,omitempty"` // To be stripped
}

var modelMapping = map[string]string{
	"gpt-4o":                  "meta/llama-3.1-70b-instruct",
	"gpt-4-turbo":             "meta/llama-3.1-70b-instruct",
	"gpt-3.5-turbo":           "meta/llama-3.1-8b-instruct",
	"claude-3-opus-20240229":  "meta/llama-3.1-70b-instruct",
	"claude-3-sonnet-20240229": "meta/llama-3.1-70b-instruct",
}

// TranslateRequest applies model translations and strips unsupported parameters.
// Returns the translated JSON body and the extracted prompt string for token estimation.
func TranslateRequest(body []byte) ([]byte, string, *float64, error) {
	var req ChatRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return nil, "", nil, fmt.Errorf("invalid json: %v", err)
	}

	// 1. Model Translation
	if mapped, ok := modelMapping[req.Model]; ok {
		req.Model = mapped
	}

	// 2. Strip unsupported parameters (e.g. logit_bias)
	req.LogitBias = nil

	// 3. Build string for token estimation
	var promptBuilder bytes.Buffer
	for _, msg := range req.Messages {
		promptBuilder.WriteString(msg.Role)
		promptBuilder.WriteString(":")
		promptBuilder.WriteString(msg.Content)
		promptBuilder.WriteString("\n")
	}

	newBody, err := json.Marshal(req)
	if err != nil {
		return nil, "", nil, err
	}

	return newBody, promptBuilder.String(), req.Temperature, nil
}
