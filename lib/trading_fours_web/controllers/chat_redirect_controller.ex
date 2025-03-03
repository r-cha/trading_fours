defmodule TradingFoursWeb.ChatRedirectController do
  use TradingFoursWeb, :controller
  alias TradingFoursWeb.Presence
  alias Phoenix.PubSub

  # Topic used to track pending rooms
  @pending_rooms_topic "pending_rooms"

  def redirect_to_room(conn, _params) do
    # Subscribe to pending rooms topic to receive updates
    PubSub.subscribe(TradingFours.PubSub, @pending_rooms_topic)
    
    # Check for pending rooms
    pending_rooms = get_pending_rooms()

    case pending_rooms do
      # If there's a pending room, join it
      [room_id | _rest] ->
        # Mark this room as no longer pending
        Presence.untrack(
          self(),
          @pending_rooms_topic,
          room_id
        )
        
        # Broadcast that the room is now filled
        PubSub.broadcast(
          TradingFours.PubSub,
          @pending_rooms_topic,
          {:room_filled, room_id}
        )
        
        redirect(conn, to: ~p"/chat/#{room_id}")

      # If no pending rooms, create a new one
      [] ->
        new_room_id = Ecto.UUID.generate()
        
        # Track this new room as pending using Presence
        {:ok, _} = Presence.track(
          self(),
          @pending_rooms_topic,
          new_room_id,
          %{
            created_at: System.system_time(:second)
          }
        )
        
        # Also broadcast the new pending room
        PubSub.broadcast(
          TradingFours.PubSub,
          @pending_rooms_topic,
          {:new_pending_room, new_room_id}
        )
        
        redirect(conn, to: ~p"/chat/#{new_room_id}")
    end
  end

  # Get list of rooms waiting for a second user
  defp get_pending_rooms do
    Presence.list(@pending_rooms_topic)
    |> Map.keys()
  end
end
