// src/components/admin/Approved.jsx
import React, { useEffect } from 'react';
import PendingReview from './PendingReview';

const Approved = (props) => {
    useEffect(() => {
        if (props.currentTab !== 'approved') props.onTabChange('approved');
    }, [props.currentTab, props.onTabChange]);

    return <PendingReview {...props} lockedTab="approved" />;
};

export default Approved;