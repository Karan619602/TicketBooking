# Online Movie Ticket Booking System Backend

# technology used

1. Node.js
2. MySQL
3. Express.js

## Endpoints

- Booking a Seat
 ```bash
 api/v1/booking/create/:userId/:showId/:seatId
 ``` 
 
- Cancel the Booking

```bash
 api/v1/booking/cancel/:BookingId
 ``` 

- Get All Available Seats for a show

```bash
 api/v1/seat/available/:showId
 ``` 


## Setup Instructions

- Clone the repository

```bash
  git clone https://github.com/Karan619602/TicketBooking.git
```

- Change the current working directory

```bash
  cd TicketBooking
```


- Install the packages

```bash
  npm i 
```

- Add .env in TicketBooking Directory and Setup Variables database_name,user_name, password and host for Database.

- Run the project

```bash
  npm start
```