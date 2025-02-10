defmodule TradingFours.Chat.Message do
  use Ecto.Schema
  import Ecto.Changeset

  schema "messages" do
    field :midi_sequence, {:array, :map}
    field :author, :string
    field :room_id, :string
    field :color, :string

    timestamps()
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [:midi_sequence, :author, :room_id, :color])
    |> validate_required([:author, :room_id, :color])
  end
end
