const {Seat,Booking,Show} = require('../models/index')


const CreateBooking= (async (req, res) => {
    const { showId, seatId,userId } = req.params;
  
    // find the screen in which show is available
    const show = await Show.findByPk(showId);
    // check if the seat is available
    
    const seat = await Seat.findOne({
      where: {
        id:seatId,
        screenId: show.screenId,
      }
    });
  
    if (seat.available) {
      // reserve the seat
      seat.available = false;
      seat.userId=userId;
      await seat.save();
  
      // create a new booking
      const booking = await Booking.create({
        showId: showId,
        seatId: seatId,
        userId: userId
      });
  
      res.status(200).json({
        message: 'Seat reserved successfully',
        bookingId: booking.id
      });
    } else {
      // suggest next available seats
      const nextavailableSeats = await Seat.findAll({
        where: {
          showId: showId,
          screenId: screenId,
          isavailable: true
        }
      });
  
      res.status(400).json({
        message: 'Seat is not available',
        nextavailableSeats: nextavailableSeats
      });
    }
  });
  
  const GetAllBookings = async (req, res) => {
    try {
      const bookings = await Booking.findAll();
      res.status(200).json({
       bookings
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  };

  const CancelSeatBooking = async (req, res) => {
    const { BookingId } = req.params;
    try {
      const booking = await Booking.findByPk(BookingId);
      if (!booking) {
        return res.status(404).json({ message: 'booking not found' });
      }
     const seat = await Seat.findOne({
        where:{
            id:booking.seatId
        }
     })
      seat.available = true;
      seat.userId=null;
      await seat.save();
 
      // delete booking from the database
      booking.destroy({where:{id:BookingId}})

      res.json({ message: 'Seat booking cancelled successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  };
  



  module.exports= {CreateBooking,GetAllBookings,CancelSeatBooking}