defmodule TradingFoursWeb.ChatController do
  use TradingFoursWeb, :live_view

  def render(assigns) do
    ~H"""
    <h1>Chat</h1>
    <form phx-submit="send_message">
      <input type="text" name="message" placeholder="Type a message...">
      <button type="submit">Send</button>
    </form>
    <%= for msg <- @messages do %>
      <div class="message">
        <strong><%= msg.author %>:</strong> <%= msg.content %>
      </div>
    <% end %>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, messages: [])}
  end

  def handle_event("send_message", %{"message" => message}, socket) do
    new_messages = [
      %{author: "User", content: message} | socket.assigns.messages
    ]
    {:noreply, assign(socket, messages: new_messages)}
  end
end
